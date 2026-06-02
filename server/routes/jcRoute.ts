import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import prismaService from "../../lib/prismaService";

const prisma = prismaService.getPrismaClient();

import { callAI } from "../../lib/aiService";

export const jcRouter = router({
  getHistory: adminProcedure
    .input(z.object({ type: z.enum(["worldcup", "regular"]).default("worldcup") }).optional())
    .query(async ({ input }) => {
      const matchType = input?.type || "worldcup";
      const predictions = await prisma.jcPrediction.findMany({
        where: {
          homeTeam: "BATCH_SCAN",
          awayTeam: matchType
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return predictions;
    }),

  updateResult: adminProcedure
    .input(z.object({
      id: z.number(),
      actualResult: z.string().optional(),
      status: z.enum(["PENDING", "FINISHED"]).default("FINISHED"),
      prizeAmount: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      const dataToUpdate: any = { status: input.status };
      if (input.actualResult !== undefined) {
        dataToUpdate.actualResult = input.actualResult;
      }
      if (input.prizeAmount !== undefined) {
        dataToUpdate.prizeAmount = input.prizeAmount;
      }
      const updated = await prisma.jcPrediction.update({
        where: { id: input.id },
        data: dataToUpdate
      });
      return updated;
    }),

  calculatePrizeWithAI: adminProcedure
    .input(z.object({
      id: z.number(),
      base64Image: z.string(),
      oddsText: z.string()
    }))
    .mutation(async ({ input }) => {
      const prediction = await prisma.jcPrediction.findUnique({
        where: { id: input.id }
      });
      if (!prediction) throw new Error("推演记录不存在");

      const prompt = `你是一个专业的体育彩票算奖助手。
这里有一张用户购买彩票的推演记录（包含买的哪些场次、预测结果，以及具体的购买方案 howToBuy）：
${JSON.stringify(prediction.prediction)}

用户实际购买时获取的赔率信息如下：
${input.oddsText}

我提供了一张官方赛果的截图（包含各场比赛的最终比分和彩果）。
请你：
1. 从截图中找到推演记录中对应的比赛场次，提取出它们的官方彩果（胜、平、负）。判断规则是全场比分左侧数字大于右侧为胜，等于为平，小于为负。
2. 将官方彩果与推演记录中的预测结果进行比对。
3. 如果有中奖的单子，请仔细阅读 \`howToBuy\` 和 \`budget\` 字段中的打票方案（可能会分为多张票，比如2串1打40元、单关打10元等）。结合用户提供的赔率，精确计算出总奖金。
   - 串关奖金公式：赔率1 × 赔率2 × ... × 该票本金
   - 单关奖金公式：赔率 × 该票本金
   （如果赔率信息不完整，请在分析过程中说明，但仍尽力判断是否红单。遇到无明细本金的，用总本金按合理推算或说明。）
4. 输出一段详细的分析过程，然后以严格的 JSON 格式返回最终结果，不要包含在 markdown 代码块中，直接返回 JSON 即可。

JSON 格式要求如下：
{
  "analysisReasoning": "你的详细分析过程，包括你找到了哪些比赛、官方结果是什么、哪些票红了哪些黑了、奖金计算明细等",
  "isHit": true或false (只要有一张票红了且有奖金即为true),
  "prizeAmount": 具体的数字金额(如果全部黑单或者无法计算则为0，保留两位小数)
}`;

      // Call Vision AI using the new aiService
      const content = await callAI({
        prompt: prompt,
        base64Image: input.base64Image,
        fallbackModels: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "claude-3-5-sonnet-20241022"],
        temperature: 0.1
      });
      
      try {
        const result = JSON.parse(content);
        return result;
      } catch(e) {
        throw new Error("AI 返回的 JSON 无法解析");
      }
    }),

  getTodayMatches: adminProcedure
    .input(z.object({ type: z.enum(["worldcup", "regular"]).default("worldcup") }).optional())
    .query(async ({ input }) => {
      const matchType = input?.type || "worldcup";
      console.log(`[JC Route] 开始获取今日竞彩赛事数据...`);
      const startTime = Date.now();
      try {
        const res = await fetch("https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=hhad,had&channel=c", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.sporttery.cn/",
            "Origin": "https://www.sporttery.cn"
          }
        });
        if (!res.ok) {
           console.error(`[JC Route] 获取体彩接口失败，状态码: ${res.status}`);
           throw new Error("Fetch failed");
        }
        const data = await res.json();
        const elapsed = Date.now() - startTime;
        console.log(`[JC Route] 体彩接口请求成功，耗时: ${elapsed}ms`);
        
        if (!data?.value?.matchInfoList) {
          console.warn(`[JC Route] 接口返回数据中没有比赛列表(matchInfoList)`);
          return [];
        }

        // Extract required data (the API groups matches by date under 'subMatchList')
        const allMatches = data.value.matchInfoList.flatMap((group: any) => group.subMatchList || []);
        
        const filteredMatches = allMatches.filter((m: any) => {
          const league = m.leagueAbbName || "";
          const isWorldCup = league.includes("世界杯") || league.includes("世预") || league.includes("世亚预") || league.includes("世欧预") || league.includes("国际赛") || league.includes("欧洲杯") || league.includes("美洲杯");
          if (matchType === "worldcup") {
            return isWorldCup;
          } else {
            return !isWorldCup;
          }
        });
        
        const totalMatches = filteredMatches.length;
        console.log(`[JC Route] 过滤后 (${matchType})，解析到今日共有 ${totalMatches} 场赛事可打`);
        
        const matches = filteredMatches.map((m: any) => ({
          matchId: m.matchId,
          matchNumStr: m.matchNumStr,
          league: m.leagueAbbName,
          homeTeam: m.homeTeamAbbName,
          awayTeam: m.awayTeamAbbName,
          matchTime: m.matchTime,
        }));
        console.log('[JC Route] 返回数据 ', matches);
        
        // Return max 10 matches to avoid AI overload
        const finalMatches = matches.slice(0, 10);
        console.log(`[JC Route] 截取前 ${finalMatches.length} 场作为焦点赛事返回前端`);
        return finalMatches;
      } catch (e: any) {
        console.error(`[JC Route] 获取今日赛事接口出现异常:`, e);
        throw new Error("获取今日赛事失败");
      }
    }),

  batchPredictMatches: adminProcedure
    .input(z.object({
      matches: z.array(z.object({
        matchNumStr: z.string(),
        league: z.string(),
        homeTeam: z.string(),
        awayTeam: z.string(),
        matchTime: z.string(),
        homeRank: z.string().optional().nullable(),
        awayRank: z.string().optional().nullable(),
        had: z.any().optional(),
        hhad: z.any().optional()
      })),
      budget: z.string().optional(),
      risk: z.string().optional(),
      type: z.enum(["worldcup", "regular"]).default("worldcup")
    }))
    .mutation(async ({ input }) => {
      const aiRole = input.type === "worldcup" 
        ? "你是专业的体育竞彩数据分析师，也是资深的世界杯专家。" 
        : "你是专业的体育竞彩数据分析师，精通五大联赛等常规足彩赛事。";

      const matchesStr = input.matches.map(m => {
        let text = `[${m.matchNumStr} ${m.league}] 主队：${m.homeTeam}${m.homeRank ? `(排名${m.homeRank})` : ''} VS 客队：${m.awayTeam}${m.awayRank ? `(排名${m.awayRank})` : ''} | 比赛时间: ${m.matchTime}`;
        if (m.had && m.had.a) {
          text += ` | 标准胜平负赔率: 胜${m.had.h} 平${m.had.d} 负${m.had.a}`;
        }
        if (m.hhad && m.hhad.a) {
          text += ` | 让球(${m.hhad.goalLine}): 胜${m.hhad.h} 平${m.hhad.d} 负${m.hhad.a}`;
        }
        return text;
      }).join("\n");

      const prompt = `${aiRole}
现在我需要你对今日的以下 ${input.matches.length} 场竞彩比赛进行批量推演，并给出一个总的购彩跟单方案：
${matchesStr}

用户的购彩偏好设定如下：
- 打票总预算：${input.budget || "未指定（默认建议100元左右）"}
- 风险承受等级：${input.risk || "未指定（默认稳妥为主）"}

【核心推演策略 - 必读】
请借鉴专业的足球分析与足彩预测模型（如三维加权模型）进行深度分析：
1. 三维权重分配：战意分析(40-50%) + 赔率深度(35%) + 状态历史(15-25%)。
2. 战意分析：5星战意(保级生死战/争冠关键战/德比)、4星战意(欧战/杯赛)、2星战意(无欲无求纯荣誉战)。
3. 智能避热(降权)：必须自动识别“顶级热门”场次（如皇马、巴萨、曼城、PSG、拜仁、利物浦、阿森纳等）。对于高热比赛，必须自动下调信心值(10-15%)，最高信心不超过75%，并强制输出风险提示。
4. 结合我提供给你的最新体彩官方赔率（胜平负和让球胜平负），分析庄家对基本面的精算。如果让球或赔率出现异常，必须在推演中指出。

特别注意用户是完全不懂球的小白，请结合偏好，给出简单粗暴的“傻瓜式”打票方案。

返回要求：必须且只能返回一个合法的 JSON 对象，不要有任何其他分析文本。
格式必须严格为：
{
  "howToBuy": "（直接复制发给彩票店老板的话，必须指明几串几、编号和赛果。例如：老板，帮我打个2串1：001胜 串 002平，打50块钱）",
  "whenToBuy": "（建议购买时间，例如：今晚19:00前，必须在第一场开打前去买）",
  "whyToBuy": "（用大白话解释理由，必须明确写出预计能中奖多少钱。例如：预计能中约150-250元。主队近期状态极佳...）",
  "matches": [
    {
      "matchNumStr": "周五008",
      "homeTeam": "主队",
      "awayTeam": "客队",
      "result": "胜|平|负",
      "score": "x:y",
      "confidence": "78%",
      "heat": "高↓|中|低",
      "risk": "可能的冷门风险或避热预警",
      "reason": "单场推演理由（用一句话概括，涵盖战意、赔率信号、热度情况）"
    }
  ]
}`;

      console.log(`[JC Route] 开始批量预测，比赛数量: ${input.matches.length}, 预算: ${input.budget}, 风险: ${input.risk}`);

      try {
        let content = await callAI({ prompt });
        const parsed = JSON.parse(content.replace(/```json/gi, '').replace(/```/g, '').trim());
        parsed.budget = input.budget;

        await prisma.jcPrediction.create({
          data: {
            homeTeam: "BATCH_SCAN",
            awayTeam: input.type,
            prediction: parsed,
            status: "PENDING"
          }
        });

        return parsed;
      } catch (e: any) {
        console.error("批量预测异常:", e);
        throw new Error(e.message || "批量AI预测失败");
      }
    }),
});
