const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// 1. 安全加载本地 .env 环境变量
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const databaseUrl = process.env.DATABASE_URL || "";

console.log("\n🔄 ================================================== 🔄");
console.log("⚡ 自动爬取热门 GitHub 项目并注入去重表 (防重冷启动) ⚡");
console.log("🔄 ================================================== 🔄");

// 核心安全警示
if (databaseUrl.includes("qkgdtrkwskekhdauaaqe")) {
  console.log("\n\x1b[41m\x1b[37m 🔥【警告：当前正连接到【正式生产库】】🔥 \x1b[0m");
  console.log("\x1b[31m⚠️  爬取到的项目将直接注入到线上生产环境的去重表中！\x1b[0m\n");
} else {
  console.log("\n\x1b[32m💡【当前环境：本地开发测试库】\x1b[0m");
  console.log("💡 爬取到的项目将注入到本地开发数据库。\n");
}

const prisma = new PrismaClient();

/**
 * 抓取 Star History 前 20 项目
 */
async function fetchStarHistoryRepos() {
  try {
    console.log("🌐 正在从 star-history.com 爬取热门推荐项目...");
    const res = await fetch("https://star-history.com/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      console.warn("⚠️  无法访问 Star History 网页");
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const repos = [];

    $("a.cursor-pointer[href^='/']")
      .slice(0, 20)
      .each((_, el) => {
        const href = $(el).attr("href") || "";
        const repoPath = href.replace(/^\//, "");
        if (
          repoPath &&
          !repoPath.includes("blog") &&
          !repoPath.includes("compare")
        ) {
          repos.push(repoPath);
        }
      });
    console.log(`   - ✅ 成功抓取到 ${repos.length} 个 Star History 项目`);
    return repos;
  } catch (e) {
    console.warn("❌ 抓取 Star History 失败:", e.message);
    return [];
  }
}

/**
 * 抓取 GitHub Trending 项目
 */
async function fetchGitHubTrendingRepos(since = "daily") {
  try {
    console.log(`🌐 正在从 GitHub Trending (${since}) 爬取热门项目...`);
    const res = await fetch(`https://github.com/trending?since=${since}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      console.warn(`⚠️  无法访问 GitHub Trending (${since}) 网页`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const repos = [];

    $("article.Box-row h2.h3 a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const repoPath = href.replace(/^\//, "");
      if (repoPath) {
        repos.push(repoPath);
      }
    });
    console.log(`   - ✅ 成功抓取到 ${repos.length} 个 GitHub Trending 项目`);
    return repos;
  } catch (e) {
    console.warn(`❌ 抓取 GitHub Trending (${since}) 失败:`, e.message);
    return [];
  }
}

async function main() {
  // 1. 并发爬取 Star History 推荐项目与 GitHub Trending (Daily) 热门项目
  const [starHistoryRepos, trendingRepos] = await Promise.all([
    fetchStarHistoryRepos(),
    fetchGitHubTrendingRepos("daily"),
  ]);

  // 2. 将爬取到的项目进行去重合并
  const allReposSet = new Set([...starHistoryRepos, ...trendingRepos]);
  const finalRepos = Array.from(allReposSet);

  if (finalRepos.length === 0) {
    console.error("\n❌ 错误：未能从网页上爬取到任何有效的 GitHub 项目！请检查网络或代理配置。");
    process.exit(1);
  }

  console.log(`\n📦 爬取去重完成，共获取到 ${finalRepos.length} 个独特的热门项目。`);
  console.log("🚀 开始自动刷入数据库...");

  let successCount = 0;
  let skipCount = 0;

  // 3. 批量 upsert 刷入去重表，并将 isPublished 设为 true 拦截重复发送
  for (const repoPath of finalRepos) {
    try {
      await prisma.gitHubProject.upsert({
        where: { repoPath: repoPath },
        update: { isPublished: true },
        create: {
          repoPath: repoPath,
          isPublished: true,
        },
      });
      console.log(`   - ✅ [已刷入] ${repoPath}`);
      successCount++;
    } catch (err) {
      console.error(`   - ❌ [注入失败] ${repoPath}:`, err.message);
      skipCount++;
    }
  }

  console.log(`\n\x1b[32m✨ 刷库完成！成功自动爬取并注入/更新: ${successCount} 个项目，失败/跳过: ${skipCount} 个项目。\x1b[0m\n`);
}

main()
  .catch((e) => {
    console.error("\n❌ 自动爬取注入过程中发生致命错误:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

