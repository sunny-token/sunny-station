import { NextResponse } from "next/server";

// ============================================
// [主动重构] 统一管理赛道与账号配置的强绑定关系
// ============================================
// 只要修改请求里的 track 字段，就会自动匹配对应的 workflow_id、appid 和 appsecret
const TRACK_CONFIGS: Record<
  string,
  { workflow_id: string; appid?: string; appsecret?: string }
> = {
  职场: {
    workflow_id: "7626203932684058676", // 职场专属工作流
    appid: process.env.APPID, // 职场对应公众号 AppID
    appsecret: process.env.APPSECRET, // 职场对应公众号 AppSecret
  },
  // 将来需要新增别的赛道时，在此处解开注释并配置即可：
  // 科技: {
  //   workflow_id: process.env.WORKFLOW_ID_TECH || "另一个工作流ID",
  //   appid: process.env.APPID_TECH,
  //   appsecret: process.env.APPSECRET_TECH,
  // },
};

export async function POST(req: Request) {
  try {
    // ============================================
    // 1. 初始化环境变量、配置与校验
    // ============================================
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const COZE_API_TOKEN = process.env.COZE_API_TOKEN;

    // 前端调用时，只需要传 track 即可 (例如 { "track": "职场" })
    const { track = "职场" } = await req.json().catch(() => ({}));

    // 获取当前赛道绑定的所有核心配置
    const currentConfig = TRACK_CONFIGS[track];

    if (!currentConfig) {
      return NextResponse.json(
        {
          error: `不被支持的赛道: ${track}。请先在代码 TRACK_CONFIGS 中配置。`,
        },
        { status: 400 },
      );
    }

    const { workflow_id, appid, appsecret } = currentConfig;

    if (!GEMINI_API_KEY || !COZE_API_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Environment variables GEMINI_API_KEY and COZE_API_TOKEN must be configured.",
        },
        { status: 500 },
      );
    }

    // ============================================
    // 2. 请求 Gemini 获取最近7天的公众号爆款主题
    // ============================================

    // 获取今天的北京时间，打破大模型的缓存幻觉
    const today = new Date().toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });

    const geminiPrompt = `今天是实时的 ${today}。作为资深的新媒体运营和热点分析师，请你结合当下最新的互联网关注风向或者能引发情绪共鸣的现象，生成【过去7天内，微信公众号${track}赛道最具爆发力和高讨论度的3个核心爆款主题/话题】。
强烈要求：
1. 绝对不要输出老生常谈的经典痛点（比如“35岁职场危机”、“如何搞副业”这种不论哪年都能写的话题），必须具备“极高近期热度”或“新颖反差感”。
2. 仅输出这3个核心主题的名称（简短精准概括，不要带序号，用逗号分隔，绝不要任何前言后语和分析）。`;

    // 使用 Gemini 的 REST API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const gErr = await geminiRes.json();
      throw new Error(`Gemini API Error: ${JSON.stringify(gErr)}`);
    }

    const geminiData = await geminiRes.json();
    const trendingTopics =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "未正常获取到热门主题";

    // const trendingTopics = "35岁职场危机"; // 暂时写死测试 Coze 流转
    console.log("[Gemini Topics generated]:", trendingTopics);

    // ============================================
    // 3. 将 Gemini 输出结果传递给 Coze 工作流 (流式模式防止超时)
    // ============================================
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
          topic: trendingTopics,
        },
        ext: {},
      }),
    });

    if (!cozeRes.ok) {
      const errorData = await cozeRes.json();
      throw new Error(`Coze API Error: ${JSON.stringify(errorData)}`);
    }

    // ============================================
    // 4. 返回流式数据 (SSE 代理) 到前端
    // ============================================
    // 前端在使用这部分 API 时也能像对接 ChatGPT 的流式输出一样获得实时打字效果，防止网关层超时拦截
    return new Response(cozeRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[Automated Pipeline Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
