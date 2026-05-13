import { NextResponse } from "next/server";
import prismaService from "@/lib/prismaService";

const prisma = prismaService.getPrismaClient();

// ============================================
// [配置管理] Skill 赛道专用配置
// ============================================
const TRACK_CONFIGS: Record<
  string,
  { workflow_id: string; appid?: string; appsecret?: string }
> = {
  Skill: {
    workflow_id: "7637461730737700910", // 你的 Skill 专题工作流 ID
    appid: process.env.APPID,
    appsecret: process.env.APPSECRET,
  },
};

const SOURCE_URLS = [
  { url: "https://skills.sh/trending", name: "skills.sh" }, // 锁定 24h 趋势榜路径
  { url: "https://r.jina.ai/https://skillsmp.com/", name: "skillsmp" },
];

import * as cheerio from "cheerio";

interface SkillItem {
  slug: string;
  name: string;
  source: string;
  rank: number;
  url: string;
  author?: string;
  githubUrl?: string;
}

export async function POST(req: Request) {
  try {
    const COZE_API_TOKEN = process.env.COZE_API_TOKEN;

    // 1. 获取请求参数
    const {
      manual_url,
      track = "Skill",
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
    let selectedSkill: SkillItem | null = null;
    let github_url = "";

    /**
     * 规范化 GitHub URL，去掉末尾斜杠和 .git
     */
    function githubUrlNormalizer(url: string) {
      return url.replace(/\/$/, "").replace(/\.git$/, "");
    }

    async function extractGithubUrl(url: string): Promise<string> {
      try {
        console.log(`[Detail Scrape] 正在进入详情页提取 GitHub 链接: ${url}`);
        const detailRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(10000),
        } as any);
        const detailHtml = await detailRes.text();
        const $detail = cheerio.load(detailHtml);

        let extracted_github_url = "";
        $detail("a[href*='github.com']").each((_, el) => {
          let href = $detail(el).attr("href") || "";

          // 逻辑 A: 如果是嵌套在 URL 参数里的 (如 manus.im/?githubUrl=...)
          if (href.includes("githubUrl=")) {
            try {
              const urlParts = href.split("?");
              const urlParams = new URLSearchParams(urlParts[1]);
              const nestedUrl = urlParams.get("githubUrl");
              if (nestedUrl && nestedUrl.includes("github.com")) {
                href = nestedUrl;
              }
            } catch (e) {
              console.warn("Failed to parse nested GitHub URL:", e);
            }
          }

          // 逻辑 B: 过滤掉明显的无关链接
          if (
            href &&
            href.includes("github.com") &&
            !href.includes("/issues") &&
            !href.includes("/pulls") &&
            !href.includes("/stargazers") &&
            !href.includes("manus.im")
          ) {
            // 提取仓库首页逻辑: https://github.com/作者/仓库名
            const githubMatch = href.match(
              /https?:\/\/github\.com\/([^/]+\/[^/]+)/,
            );
            if (githubMatch) {
              extracted_github_url = `https://github.com/${githubMatch[1]}`;
            } else {
              extracted_github_url = href.split("?")[0];
            }
            return false; // 找到第一个就跳出
          }
        });

        if (extracted_github_url) {
          console.log(`[Detail Scrape] 成功提取 GitHub 链接: ${extracted_github_url}`);
        }
        return extracted_github_url;
      } catch (e) {
        console.warn("[Detail Scrape Failed]:", e);
        return "";
      }
    }

    async function checkGithubDuplicate(githubUrl: string): Promise<boolean> {
      const existingSkill = await prisma.skillProject.findFirst({
        where: {
          githubUrl: githubUrlNormalizer(githubUrl),
          isPublished: true,
        },
      });

      const repoPath = githubUrl.replace(/https?:\/\/github\.com\//, "").split(/[?#]/)[0];
      const existingGit = await prisma.gitHubProject.findFirst({
        where: {
          repoPath: repoPath,
          isPublished: true,
        },
      });

      return !!(existingSkill || existingGit);
    }

    // ============================================
    // 2. 获取数据源并去重
    // ============================================
    if (manual_url) {
      sourceData = manual_url;
      github_url = await extractGithubUrl(sourceData);

      if (github_url) {
        const isDuplicate = await checkGithubDuplicate(github_url);
        if (isDuplicate) {
          console.log(`[Skip] 该项目已发布过 (GitHub: ${github_url})`);
          return NextResponse.json({
            success: true,
            message: "该 GitHub 项目已发布过，跳过重复处理",
          });
        }
      }
    } else {
      console.log(`[${track}] 启动自动化抓取与去重...`);

      // 并发抓取两个站点的 Markdown
      // 并发抓取两个站点的原始 HTML
      const pages = await Promise.all(
        SOURCE_URLS.map(async (src) => {
          try {
            const res = await fetch(src.url, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
              signal: AbortSignal.timeout(10000),
            } as any);
            const html = await res.text();
            return { source: src.name, html };
          } catch (e) {
            console.error(`Fetch failed for ${src.name}:`, e);
            return null;
          }
        }),
      );

      const allSkills: SkillItem[] = [];

      pages.filter(Boolean).forEach((page: any) => {
        const $ = cheerio.load(page.html);
        console.log(
          `[Fetch Result] Source: ${page.source}, HTML Length: ${page.html.length}`,
        );

        if (page.source === "skills.sh") {
          let rank = 1;
          // 锁定表格区域，通常 Skill 列表在 table 中
          $("table a, main a").each((_, el) => {
            const href = $(el).attr("href") || "";
            const name = $(el).text().trim();

            if (href.startsWith("http") && !href.includes("skills.sh")) return;
            const path = href
              .replace(/^https:\/\/skills\.sh/, "")
              .replace(/^\//, "");
            const parts = path.split("/");

            // 精确匹配 author/repo/skill 结构
            if (
              parts.length >= 2 &&
              !parts[0].includes(".") &&
              !["s", "trending", "blog", "docs", "about"].includes(parts[0])
            ) {
              const author = parts[0];
              const slugPart = parts.slice(1).join("-");
              const fullUrl = `https://skills.sh/${path}`;

              // 避免重复存入同一个 Skill (一个行可能有多个链接)
              if (
                !allSkills.find(
                  (s) => s.slug === `sh/${author}/${slugPart}`.toLowerCase(),
                )
              ) {
                allSkills.push({
                  name: name || slugPart,
                  slug: `sh/${author}/${slugPart}`.toLowerCase(),
                  source: "skills.sh",
                  rank: rank++,
                  author,
                  url: fullUrl,
                });
              }
            }
          });
        } else if (page.source === "skillsmp") {
          let rank = 1;
          // 适配 r.jina.ai 返回的 Markdown 格式
          const lines = page.html.split("\n");
          lines.forEach((line: string) => {
            const mpMatch = line.match(
              /\[(.*?)\]\((https:\/\/skillsmp\.com\/skills\/(.*?))\)/,
            );
            if (mpMatch) {
              const name = mpMatch[1];
              const fullPath = mpMatch[3].split(/[?#)]/)[0];
              const author = fullPath.split("-")[0] || "unknown";
              const fullUrl = `https://skillsmp.com/skills/${fullPath}`;
              allSkills.push({
                name: name || fullPath,
                slug: `mp/${fullPath}`.toLowerCase(),
                source: "skillsmp",
                rank: rank++,
                author,
                url: fullUrl,
              });
            }
          });

          // 如果正则没抓到，尝试 Cheerio (兼容原始 HTML 模式)
          if (allSkills.length === 0) {
            $("a[href*='/skills/']").each((_, el) => {
              const href = $(el).attr("href") || "";
              const name = $(el).text().trim();
              const fullPath = href.split("/skills/")[1]?.split(/[?#]/)[0];
              if (fullPath) {
                const author = fullPath.split("-")[0] || "unknown";
                const fullUrl = href.startsWith("http")
                  ? href
                  : `https://skillsmp.com/skills/${fullPath}`;
                allSkills.push({
                  name: name || fullPath,
                  slug: `mp/${fullPath}`.toLowerCase(),
                  source: "skillsmp",
                  rank: rank++,
                  author,
                  url: fullUrl,
                });
              }
            });
          }
        }
      });

      console.log(
        `[Parser Result] Total skills found before filtering: ${allSkills.length}`,
      );
      if (allSkills.length > 0) {
        // 去重并打印前 5 个
        const uniqueSlugs = Array.from(new Set(allSkills.map((s) => s.slug)));
        console.log(
          `[Extracted Slugs (Unique Top 5)]:`,
          uniqueSlugs.slice(0, 5),
        );
      }

      // 数据库去重过滤
      const slugs = allSkills.map((s) => s.slug);
      const sentSkills = await prisma.skillProject.findMany({
        where: {
          skillSlug: { in: slugs },
          isPublished: true,
        },
        select: { skillSlug: true },
      });
      const sentSet = new Set(sentSkills.map((s) => s.skillSlug));
      console.log(
        `[Database] Found ${sentSet.size} already published skills in DB.`,
      );
      if (sentSet.size > 0) {
        console.log(`[Sent Slugs in DB]:`, Array.from(sentSet));
      }

      const filteredSkills = allSkills.filter((s) => !sentSet.has(s.slug));
      console.log(
        `[Filter Result] New skills remaining: ${filteredSkills.length}`,
      );

      if (filteredSkills.length === 0) {
        return NextResponse.json({
          success: true,
          message: "今日无新 Skill 需发布",
        });
      }

      // ============================================
      // 3. 筛选并找到第一个未发布过的项目
      // ============================================
      let foundValidSkill = false;

      for (const skill of filteredSkills) {
        selectedSkill = skill as any;
        sourceData = (selectedSkill as any).url || "";
        let temp_github_url = await extractGithubUrl(sourceData);

        if (temp_github_url) {
          const isDuplicate = await checkGithubDuplicate(temp_github_url);
          if (isDuplicate) {
            console.log(`[Skip] 该项目已发布过 (GitHub: ${temp_github_url})，尝试下一个`);
            
            // 标记为已发布，避免下次再查
            await prisma.skillProject.upsert({
              where: { skillSlug: selectedSkill!.slug },
              update: { 
                name: selectedSkill!.name, 
                source: selectedSkill!.source, 
                githubUrl: githubUrlNormalizer(temp_github_url),
                isPublished: true 
              },
              create: {
                skillSlug: selectedSkill!.slug,
                name: selectedSkill!.name,
                source: selectedSkill!.source,
                githubUrl: githubUrlNormalizer(temp_github_url),
                isPublished: true
              },
            });
            continue; // 继续寻找下一个
          }
          
          github_url = temp_github_url;
        }

        // 找到一个没重复的（或者没有 github_url 的），保存并跳出
        await prisma.skillProject.upsert({
          where: { skillSlug: selectedSkill!.slug },
          update: { 
            name: selectedSkill!.name, 
            source: selectedSkill!.source,
            githubUrl: github_url ? githubUrlNormalizer(github_url) : undefined
          },
          create: {
            skillSlug: selectedSkill!.slug,
            name: selectedSkill!.name,
            source: selectedSkill!.source,
            githubUrl: github_url ? githubUrlNormalizer(github_url) : undefined
          },
        });
        
        foundValidSkill = true;
        break; // 停止寻找
      }

      if (!foundValidSkill) {
        return NextResponse.json({
          success: true,
          message: "所有新获取的项目均已被发布，跳过",
        });
      }
    }

    // ============================================
    // 4. 执行 Coze 逻辑
    // ============================================
    const finalData = {
      url: sourceData,
      github_url: github_url,
      source: selectedSkill?.source || "manual",
      rank: selectedSkill?.rank || 0,
      name: selectedSkill?.name || "manual",
    };

    if (enableCoze === false) {
      return NextResponse.json({ success: true, data: finalData });
    }

    console.log(
      `[Sending to Coze] ${finalData.name} (GitHub: ${github_url || "N/A"})`,
    );

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
          github_url: github_url || sourceData || "",
        },
      }),
    });

    if (!cozeRes.ok) {
      const errorData = await cozeRes.json();
      throw new Error(`Coze API Error: ${JSON.stringify(errorData)}`);
    }

    // ============================================
    // 4. 更新发布状态
    // ============================================
    if (selectedSkill && selectedSkill.slug) {
      try {
        await prisma.skillProject.update({
          where: { skillSlug: selectedSkill.slug },
          data: { isPublished: true },
        });
        console.log(`[Database] 已将 ${selectedSkill.slug} 更新为已发布`);
      } catch (e) {
        console.error("[Database Update Error]:", e);
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
    console.error("[Skill Pipeline Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
