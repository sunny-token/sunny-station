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

export async function POST(req: Request) {
  try {
    const COZE_API_TOKEN = process.env.COZE_API_TOKEN;

    // 支持手动传入 github_url 和开关，如果没有则触发自动抓取
    const {
      github_url,
      track = "GitHub",
      enableCoze = false,
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
    // 1. 获取 GitHub 数据源 (Star History 每周前 20)
    // ============================================
    if (github_url) {
      sourceData = github_url;
    } else {
      try {
        const res = await fetch("https://star-history.com/", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);

          // 1.1 抓取前 20 个项目
          const allRepos: { path: string; url: string }[] = [];
          $("a.cursor-pointer[href^='/']")
            .slice(0, 20)
            .each((index, el) => {
              const href = $(el).attr("href") || "";
              const repoPath = href.replace(/^\//, "");
              if (
                repoPath &&
                !repoPath.includes("blog") &&
                !repoPath.includes("compare")
              ) {
                allRepos.push({
                  path: repoPath,
                  url: `https://github.com/${repoPath}`,
                });
              }
            });

          // 1.2 数据库去重过滤
          const sentRepos = await prisma.gitHubProject.findMany({
            where: { repoPath: { in: allRepos.map((r) => r.path) } },
            select: { repoPath: true },
          });
          const sentPathSet = new Set(sentRepos.map((r) => r.repoPath));

          // 仅保留没发过的项目
          const filteredRepos = allRepos.filter(
            (r) => !sentPathSet.has(r.path),
          );

          if (filteredRepos.length === 0) {
            sourceData = ""; // 如果没有新项目，可以置空或者直接返回
          } else {
            // 只取排名最靠前且没发过的一条
            const firstRepo = filteredRepos[0];
            sourceData = firstRepo.url;

            // 这里真正将其存入数据库去重表中，防止下次再发
            await prisma.gitHubProject.upsert({
              where: { repoPath: firstRepo.path },
              update: {},
              create: { repoPath: firstRepo.path },
            });
            console.log(
              `[Database] 已将 ${firstRepo.path} 存入 Supabase 去重表`,
            );
          }

          console.log(
            `[Star History Filtered]: ${filteredRepos.length}/${allRepos.length} items are new.`,
          );
        }
      } catch (e) {
        console.warn("[Star History Fetch Failed]:", e);
        sourceData = "数据抓取失败。";
      }
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

    console.log("[Sending to Coze Github Workflow - Raw Data]");

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
