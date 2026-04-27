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

    if (!COZE_API_TOKEN) {
      return NextResponse.json(
        {
          error: "Environment variable COZE_API_TOKEN must be configured.",
        },
        { status: 500 },
      );
    }

    // ============================================
    // 2. 直接调用 Coze 工作流 (流式模式防止超时)
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
