import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import prismaService from "@/lib/prismaService";

const prisma = prismaService.getPrismaClient();

// ============================================
// [配置管理] GitHub 赛道专用配置
// ============================================
const TRACK_CONFIGS: Record<
  string,
  { workflow_id: string; appid?: string; appsecret?: string }
> = {
  GitHub: {
    workflow_id: "7623706231228907560", // 替换为你 GitHub 专题的 Coze 工作流 ID
    appid: process.env.APPID_GITHUB,
    appsecret: process.env.APPSECRET_GITHUB,
  },
};

interface RepoItem {
  path: string;
  url: string;
}

/**
 * 抓取 Star History 每周前 20 项目
 */
async function fetchStarHistoryRepos(): Promise<RepoItem[]> {
  try {
    const res = await fetch("https://star-history.com/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const repos: RepoItem[] = [];

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
          repos.push({
            path: repoPath,
            url: `https://github.com/${repoPath}`,
          });
        }
      });
    return repos;
  } catch (e) {
    console.warn("[Star History Fetch Failed]:", e);
    return [];
  }
}

/**
 * 抓取 GitHub Trending 项目
 * @param since 'daily' | 'weekly' | 'monthly'
 */
async function fetchGitHubTrendingRepos(
  since: "daily" | "weekly" | "monthly" = "daily",
): Promise<RepoItem[]> {
  try {
    const res = await fetch(`https://github.com/trending?since=${since}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const repos: RepoItem[] = [];

    $("article.Box-row h2.h3 a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const repoPath = href.replace(/^\//, "");
      if (repoPath) {
        repos.push({
          path: repoPath,
          url: `https://github.com/${repoPath}`,
        });
      }
    });
    return repos;
  } catch (e) {
    console.warn(`[GitHub Trending ${since} Fetch Failed]:`, e);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const COZE_API_TOKEN = process.env.COZE_API_TOKEN;

    // 支持手动传入 github_url 和开关，如果没有则触发自动抓取
    const {
      github_url,
      track = "GitHub",
      enableCoze = true,
    } = await req.json().catch(() => ({}));
    const currentConfig = TRACK_CONFIGS[track];

    if (!currentConfig) {
      return NextResponse.json(
        { error: `不支持的赛道: ${track}` },
        { status: 400 },
      );
    }

    const { workflow_id, appid, appsecret } = currentConfig;

    if (!COZE_API_TOKEN) {
      return NextResponse.json(
        { error: "Environment variables missing: COZE_API_TOKEN" },
        { status: 500 },
      );
    }

    let sourceData = "";

    // ============================================
    // 1. 获取 GitHub 数据源 (支持多级降级)
    // ============================================
    if (github_url) {
      sourceData = github_url;
    } else {
      // 1.1 尝试抓取 Star History
      const starHistoryRepos = await fetchStarHistoryRepos();
      
      // 辅助去重函数
      const filterNewRepos = async (repos: RepoItem[]) => {
        if (repos.length === 0) return [];
        const sentRepos = await prisma.gitHubProject.findMany({
          where: {
            repoPath: { in: repos.map((r) => r.path) },
            isPublished: true,
          },
          select: { repoPath: true },
        });
        const sentPathSet = new Set<string>(sentRepos.map((r: any) => r.repoPath));
        return repos.filter((r) => !sentPathSet.has(r.path));
      };

      let filteredRepos = await filterNewRepos(starHistoryRepos);

      // 1.2 如果 Star History 无新项目，依次尝试 GitHub Trending (日/周/月)
      if (filteredRepos.length === 0) {
        console.log("[Fallback] Star History 无新项目，进入 GitHub Trending 多级降级...");
        
        const ranges: ("daily" | "weekly" | "monthly")[] = ["daily", "weekly", "monthly"];
        for (const range of ranges) {
          console.log(`[Trending Fallback] 正在尝试: ${range}`);
          const trendingRepos = await fetchGitHubTrendingRepos(range);
          filteredRepos = await filterNewRepos(trendingRepos);
          
          if (filteredRepos.length > 0) {
            console.log(`[GitHub Trending ${range}] 成功发现 ${filteredRepos.length} 个新项目`);
            break;
          }
        }
      }

      // 1.3 最终检查
      if (filteredRepos.length === 0) {
        console.log("[GitHub] 穷尽所有来源（Star History & Trending D/W/M）均无新项目，跳过。");
        return NextResponse.json({
          success: true,
          message: "所有推荐来源均无新项目，本次跳过。",
        });
      }

      // 1.4 锁定本次要发的项目
      const firstRepo = filteredRepos[0];
      sourceData = firstRepo.url;

      await prisma.gitHubProject.upsert({
        where: { repoPath: firstRepo.path },
        update: {},
        create: { repoPath: firstRepo.path },
      });
      console.log(`[Database] 已将 ${firstRepo.path} 锁定入去重表`);
    }

    // ============================================
    // 2. Coze 逻辑执行开关
    // ============================================
    // 如果 enableCoze 为 false，则直接返回抓取结果，不触发工作流
    if (enableCoze === false) {
      console.log("[Coze Logic Skipped] Returning raw data only.");
      return NextResponse.json({
        success: true,
        data: sourceData,
      });
    }

    console.log("[Sending to Coze Github Workflow - Raw Data]", sourceData);

    const cozeRes = await fetch("https://api.coze.cn/v1/workflow/stream_run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COZE_API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        workflow_id: workflow_id,
        parameters: {
          appid: appid,
          appsecret: appsecret,
          github_url: sourceData || github_url || "",
        },
      }),
    });

    if (!cozeRes.ok) {
      const errorData = await cozeRes.json();
      throw new Error(`Coze API Error: ${JSON.stringify(errorData)}`);
    }

    // ============================================
    // 3. 发布成功，更新数据库状态
    // ============================================
    if (sourceData && sourceData.startsWith("https://github.com/") && !github_url) {
      try {
        const repoPath = sourceData.replace("https://github.com/", "");
        await prisma.gitHubProject.update({
          where: { repoPath: repoPath },
          data: { isPublished: true },
        });
        console.log(`[Database] 已将 ${repoPath} 状态更新为已发布 (isPublished: true)`);
      } catch (dbError) {
        console.error("[Database Update Error]:", dbError);
        // 不抛出错误，以免影响正常的流返回
      }
    }

    return new Response(cozeRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[GitHub Pipeline Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
