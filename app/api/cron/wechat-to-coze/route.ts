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

    // 引入随机的受众情绪/内容切入视角，作为微小的“随机扰动系统（Random Trigger）”
    // 强制每次请求迫使模型更换思考路径，大幅降低重复率
    const angleList = [
      "职场反常识/打破向上管理与升职加薪的固有认知",
      "打工人的隐秘痛点/职场PUA、背锅与无意义的精神内耗",
      "大厂生存法则/行业内幕、潜规则与真实的绩效考核",
      "搞钱焦虑与副业/同龄人攀比下的跳槽与薪资倒挂现象",
      "极端职场情绪/想要裸辞的冲动、裁员恐慌或强烈打工共鸣",
      "职场社交货币/用来在摸鱼群吐槽或与平级同事抱团的谈资",
      "新型职场现象/00后整顿职场、反内卷或新型“带薪拉屎”观察",
      "职业发展瓶颈/35岁职场危机、晋升天花板与被迫转行的无奈",
    ];
    const randomAngle = angleList[Math.floor(Math.random() * angleList.length)];

    // ============================================
    // [主动重构] 方案3升级：抓取真实的实时热搜数据冲减幻觉
    // ============================================
    let realTimeKeywords = "";
    try {
      // 改用百度官方公共热榜 API（无跨域，无鉴权，绝不会 401 拦截）
      const hotRes = await fetch(
        "https://top.baidu.com/api/board?platform=pc&sa=pcindex_a_right",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
          },
          next: { revalidate: 3600 },
        },
      );
      if (hotRes.ok) {
        const hotData = await hotRes.json();
        // 百度热搜的结构在 data.cards[0].content 数组里
        if (hotData.data?.cards?.[0]?.content) {
          const topList = hotData.data.cards[0].content;
          const top5 = topList.slice(0, 5).map((item: any) => item.word);
          realTimeKeywords = `目前全网最真实的实时热搜前五名是：[${top5.join("、")}]。`;
          console.log("[Hot Keywords Fetched Successfully]:", top5);
        }
      } else {
        console.warn(
          `[Hot Search API Blocked/Failed Code]: HTTP ${hotRes.status}`,
        );
      }
    } catch (e) {
      console.warn("[Hot Search API Throw, gracefully downgrading]:", e);
    }

    const geminiPrompt = `今天是实时的 ${today}。${realTimeKeywords}请重点采用【${randomAngle}】切入点。
生成【微信公众号${track}赛道极简的 3 个核心讨论话题（Topic Keywords）】。
要求：
1. 不要长句标题！只需要核心关键词组合（比如“微信支付出海”、“大厂隐性降薪”、“千万打赏陷阱”）。
2. 字数极致压缩！每个话题绝对不要超过 8 个字！
3. 请严格以 JSON 字符串数组格式输出这 3 个话题！绝不要多说任何废话。
示例格式：
["微信出海","降薪现状","打赏乱象"]`;

    // 使用 Gemini 的 REST API (增加高频并发下 503 错误的自动重试机制)
    let geminiRes: Response | null = null;
    let retries = 3;
    while (retries > 0) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: {
              temperature: 0.8, // 稍微降低一点温度，增加输出稳定性
              maxOutputTokens: 800,
            },
          }),
        },
      );

      // 如果遇到对方服务器满载拥堵（503），等待 2 秒再重试
      if (geminiRes.status === 503) {
        retries--;
        if (retries === 0) break;
        console.warn(
          `[Gemini API 503 Unavailable] 官方服务器高负荷拥堵中，暂停 2 秒后开启第 ${4 - retries} 次自动重试...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      // 如果是其他错误或者 200 成功，直接跳出重试逻辑
      break;
    }

    if (!geminiRes) {
      throw new Error("Gemini API Error: 服务持续不可用，重试多次后依然失败。");
    }

    if (!geminiRes.ok) {
      const gErr = await geminiRes.json();
      throw new Error(`Gemini API Error: ${JSON.stringify(gErr)}`);
    }

    const geminiData = await geminiRes.json();

    // 合并所有的 parts（有些实验性模型会把长文本切开在非流式下返回）
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    let rawText = parts
      .map((p: any) => p.text || "")
      .join("")
      .trim();

    // ============================================
    // 硬核诊断日志展示：检查大模型底层是否因为限制截断
    // ============================================
    console.log("[Gemini Raw Diagnostic]:", {
      finishReason: geminiData.candidates?.[0]?.finishReason,
      totalWords: rawText.length,
      first50Chars: rawText.slice(0, 50),
    });

    if (!rawText) {
      rawText = "未正常获取到热门主题";
    }

    // ============================================
    // 采用正则容错提取 JSON 数组，防止它多说了废话
    // ============================================
    let trendingTopics = rawText;
    try {
      // 使用 [\s\S]* 替代 .* 配合 /s 标志，从而兼容老版本 TS 的编译规则
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        // 提取完毕后用逗号拼接，还原成 Coze 需要的格式
        trendingTopics = arr.join(",");
      }
    } catch (e) {
      console.warn("解析 JSON 数组失败，使用原始兜底文本:", e);
    }

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
