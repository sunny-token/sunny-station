import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import prismaService from "../../lib/prismaService";
import { callAI } from "../../lib/aiService";

const prisma = prismaService.getPrismaClient();

function getNextIssueNumber(currentIssue: string): string {
  if (!currentIssue || currentIssue.length < 5) return "";
  
  // 区分双色球(7位)和大乐透(5位)的期号格式
  // 双色球: 2024058 (4位年份 + 3位期号)
  // 大乐透: 24058 (2位年份 + 3位期号)
  const yearLen = currentIssue.length === 5 ? 2 : 4;
  
  const year = currentIssue.substring(0, yearLen);
  const numStr = currentIssue.substring(yearLen);
  const nextNum = parseInt(numStr, 10) + 1;
  return `${year}${String(nextNum).padStart(numStr.length, "0")}`;
}

function getPrevIssueNumber(currentIssue: string): string {
  if (!currentIssue || currentIssue.length < 5) return "";
  const yearLen = currentIssue.length === 5 ? 2 : 4;
  const year = currentIssue.substring(0, yearLen);
  const numStr = currentIssue.substring(yearLen);
  const prevNum = parseInt(numStr, 10) - 1;
  if (prevNum <= 0) return "";
  return `${year}${String(prevNum).padStart(numStr.length, "0")}`;
}

function getNextDrawDate(lastDrawDate: Date, lotteryType: string): Date {
  const date = new Date(lastDrawDate);
  const day = date.getDay(); // 0 是周日, 1-6 是周一到周六
  
  if (lotteryType === "ssq") {
    // 双色球每周二(2)、四(4)、日(0)开奖
    let daysToAdd = 2;
    if (day === 2) daysToAdd = 2; 
    else if (day === 4) daysToAdd = 3; 
    else if (day === 0) daysToAdd = 2; 
    else {
      if (day === 1) daysToAdd = 1; 
      else if (day === 3) daysToAdd = 1; 
      else if (day === 5) daysToAdd = 2; 
      else if (day === 6) daysToAdd = 1; 
    }
    date.setDate(date.getDate() + daysToAdd);
  } else {
    // 大乐透每周一(1)、三(3)、六(6)开奖
    let daysToAdd = 2;
    if (day === 1) daysToAdd = 2; 
    else if (day === 3) daysToAdd = 3; 
    else if (day === 6) daysToAdd = 2; 
    else {
      if (day === 0) daysToAdd = 1; 
      else if (day === 2) daysToAdd = 1; 
      else if (day === 4) daysToAdd = 2; 
      else if (day === 5) daysToAdd = 1; 
    }
    date.setDate(date.getDate() + daysToAdd);
  }
  return date;
}

async function enrichPredictions(predictions: any[]) {
  if (predictions.length === 0) return predictions;

  // 收集当前期号与前一期号，以实现一次性批量查询
  const ssqIssuesSet = new Set<string>();
  const dltIssuesSet = new Set<string>();

  predictions.forEach(p => {
    if (p.lotteryType === "ssq") {
      ssqIssuesSet.add(p.issueNumber);
      const prev = getPrevIssueNumber(p.issueNumber);
      if (prev) ssqIssuesSet.add(prev);
    } else {
      dltIssuesSet.add(p.issueNumber);
      const prev = getPrevIssueNumber(p.issueNumber);
      if (prev) dltIssuesSet.add(prev);
    }
  });

  const ssqIssues = Array.from(ssqIssuesSet);
  const dltIssues = Array.from(dltIssuesSet);

  const ssqResultsMap = new Map<string, any>();
  const dltResultsMap = new Map<string, any>();

  if (ssqIssues.length > 0) {
    const ssqResults = await prisma.sSQResult.findMany({
      where: { issueNumber: { in: ssqIssues } }
    });
    ssqResults.forEach(r => ssqResultsMap.set(r.issueNumber, r));
  }

  if (dltIssues.length > 0) {
    const dltResults = await prisma.dLTResult.findMany({
      where: { issueNumber: { in: dltIssues } }
    });
    dltResults.forEach(r => dltResultsMap.set(r.issueNumber, r));
  }

  return predictions.map(pred => {
    const hits = pred.hitDetail
      ? (typeof pred.hitDetail === "string" ? JSON.parse(pred.hitDetail) : pred.hitDetail)
      : null;

    if (!Array.isArray(hits)) return pred;

    const resultsMap = pred.lotteryType === "ssq" ? ssqResultsMap : dltResultsMap;
    const drawResult = resultsMap.get(pred.issueNumber);

    // 计算或获取开奖时间
    let openDate: Date | null = null;
    let isEstimated = false;

    if (drawResult) {
      openDate = drawResult.openDate;
    } else {
      // 动态推算 PENDING 期的开奖时间
      const prevIssue = getPrevIssueNumber(pred.issueNumber);
      const prevResult = resultsMap.get(prevIssue);
      if (prevResult && prevResult.openDate) {
        openDate = getNextDrawDate(prevResult.openDate, pred.lotteryType);
        isEstimated = true;
      }
    }

    const enrichedHits = hits.map((hit: any) => {
      if (!hit.isWinner) return { ...hit, prizeMoney: 0 };

      const prizeName = hit.prize || "其它";
      let prizeMoney = 0;

      if (drawResult && drawResult.prizeAmounts) {
        const amounts = typeof drawResult.prizeAmounts === "string"
          ? JSON.parse(drawResult.prizeAmounts)
          : drawResult.prizeAmounts;
        if (Array.isArray(amounts)) {
          const matchedPrize = amounts.find((a: any) => a.level === prizeName || (prizeName.includes("等奖") && a.level.includes(prizeName.replace("等奖", ""))));
          if (matchedPrize && matchedPrize.amount) {
            const amtNum = parseFloat(String(matchedPrize.amount).replace(/,/g, ''));
            if (!isNaN(amtNum)) {
              prizeMoney = amtNum;
            }
          }
        }
      }

      return {
        ...hit,
        prizeMoney
      };
    });

    // 对返回的号码统一排序，保证前端显示的红球蓝球为升序
    let sortedPredictedNumbers = pred.predictedNumbers;
    if (typeof sortedPredictedNumbers === "string") {
      try { sortedPredictedNumbers = JSON.parse(sortedPredictedNumbers); } catch(e) {}
    }
    if (Array.isArray(sortedPredictedNumbers)) {
      sortedPredictedNumbers = sortedPredictedNumbers.map((combo: any) => ({
        ...combo,
        red: Array.isArray(combo.red) ? [...combo.red].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) : combo.red,
        blue: Array.isArray(combo.blue) ? [...combo.blue].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) : combo.blue,
      }));
    }

    return {
      ...pred,
      predictedNumbers: sortedPredictedNumbers,
      hitDetail: enrichedHits,
      openDate,
      isEstimated
    };
  });
}

export const aiRouter = router({
  predictNumbers: publicProcedure
    .input(z.object({ type: z.enum(["ssq", "dlt"]) }))
    .mutation(async ({ input }) => {
      // 获取历史开奖数据（最近100期作为样本，避免超出上下文）
      let historyData = "";
      if (input.type === "ssq") {
        const results = await prisma.sSQResult.findMany({
          orderBy: { openDate: "desc" },
          take: 100,
        });
        historyData = results.map(r => {
          const red = (r.openNumbers as any).red.join(",");
          const blue = Array.isArray((r.openNumbers as any).blue) ? (r.openNumbers as any).blue.join(",") : (r.openNumbers as any).blue;
          return `期号:${r.issueNumber} 红球:${red} 蓝球:${blue}`;
        }).join("\n");
      } else {
        const results = await prisma.dLTResult.findMany({
          orderBy: { openDate: "desc" },
          take: 100,
        });
        historyData = results.map(r => {
          const red = (r.openNumbers as any).red.join(",");
          const blue = (r.openNumbers as any).blue.join(",");
          return `期号:${r.issueNumber} 前区:${red} 后区:${blue}`;
        }).join("\n");
      }

      const lotteryName = input.type === "ssq" ? "双色球" : "大乐透";
      const rule = input.type === "ssq" 
        ? "红球6个(01-33)，蓝球1个(01-16)" 
        : "前区5个(01-35)，后区2个(01-12)";

      const prompt = `你是专业的彩票数据分析师。这里是最近100期的${lotteryName}开奖历史：\n${historyData}\n
请根据这些数据进行走势分析，并给出5注下一期最有可能的推荐号码。
规则要求：${rule}
返回要求：必须且只能返回一个合法的 JSON 数组，不要有任何其他分析文本。数组包含5个对象，每个对象结构必须为 {"red": ["xx","xx",...], "blue": ["xx",...], "reason": "简短的一句话推演理由"}，其中红球和蓝球（或后区）里的数字必须补齐两位数（例如"01"），reason 字段提供该注号码的生成逻辑 or 冷热走势依据（约20-30字）。请注意，你现在预测的是${lotteryName}，因此 blue 数组的长度必须严格为 ${input.type === "ssq" ? "1" : "2"}。`;

      try {
        const content = await callAI({ prompt });
        
        // 解析 JSON
        const parsed = JSON.parse(content.replace(/```json/gi, '').replace(/```/g, '').trim());

        // 对 AI 返回的红蓝球号码进行排序
        if (Array.isArray(parsed)) {
          parsed.forEach((combo: any) => {
            if (Array.isArray(combo.red)) {
              combo.red.sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
            }
            if (Array.isArray(combo.blue)) {
              combo.blue.sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
            }
          });
        }

        // 将预测结果异步持久化到数据库
        try {
          let latestResult = null;
          if (input.type === "ssq") {
            latestResult = await prisma.sSQResult.findFirst({
              orderBy: { issueNumber: "desc" },
            });
          } else {
            latestResult = await prisma.dLTResult.findFirst({
              orderBy: { issueNumber: "desc" },
            });
          }

          const currentYear = new Date().getFullYear().toString();
          const nextIssue = latestResult ? getNextIssueNumber(latestResult.issueNumber) : `${currentYear}001`;

          await prisma.aIPrediction.create({
            data: {
              lotteryType: input.type,
              issueNumber: nextIssue,
              predictedNumbers: parsed,
              status: "PENDING",
            },
          });
          console.log(`[AI Route] 成功记录 ${input.type} 预测号码，目标期号: ${nextIssue}`);
        } catch (dbErr) {
          console.error("[AI Route] 写入 AI 预测号码失败:", dbErr);
        }

        return parsed;
      } catch (e: any) {
        console.error("AI 智能选号请求/解析异常:", e);
        
        let userMessage = "大模型服务繁忙或网络波动，请稍后再试";
        
        if (e.message) {
          const msg = e.message.toLowerCase();
          if (msg.includes("prisma") || msg.includes("database") || msg.includes("pooler") || msg.includes("pool")) {
            userMessage = "当前请求人数过多导致系统繁忙，请稍后重试";
          } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("请求ai接口失败")) {
            userMessage = "连接智能推演中枢超时，请检查网络或稍后重新推演";
          } else if (msg.includes("json") || msg.includes("parse")) {
            userMessage = "AI 预测引擎返回的号码格式无法识别，请重新测算";
          } else if (msg.includes("gptgod_api_key") || msg.includes("api key") || msg.includes("配置")) {
            userMessage = "AI 测算服务尚未配置访问密钥或可用模型均失败，请联系系统管理员";
          }
        }
        
        throw new Error(userMessage);
      }
    }),

  getPredictionHistory: publicProcedure
    .input(
      z.object({
        type: z.enum(["ssq", "dlt"]).optional(),
        take: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      const where = input.type ? { lotteryType: input.type } : {};
      const predictions = await prisma.aIPrediction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.take,
      });
      return await enrichPredictions(predictions);
    }),

  getPredictionStats: publicProcedure
    .input(z.object({ type: z.enum(["ssq", "dlt"]) }))
    .query(async ({ input }) => {
      try {
        const predictions = await prisma.aIPrediction.findMany({
          where: {
            lotteryType: input.type,
            status: "OPENED",
          },
          orderBy: { createdAt: "desc" },
        });

        // 收集所有关联的期号进行一次性批量查询
        const issueNumbers = predictions.map(p => p.issueNumber);
        const resultsMap = new Map<string, any>();

        if (issueNumbers.length > 0) {
          if (input.type === "ssq") {
            const results = await prisma.sSQResult.findMany({
              where: { issueNumber: { in: issueNumbers } }
            });
            results.forEach(r => resultsMap.set(r.issueNumber, r));
          } else {
            const results = await prisma.dLTResult.findMany({
              where: { issueNumber: { in: issueNumbers } }
            });
            results.forEach(r => resultsMap.set(r.issueNumber, r));
          }
        }

        let totalPredictions = predictions.length;
        let totalBets = totalPredictions * 5; // 每期预测5注
        let winningBets = 0;
        let totalRedHits = 0;
        let totalBlueHits = 0;
        let totalPrizeMoney = 0;
        
        // 奖级统计
        const prizeDistribution: Record<string, number> = {};
        
        // 最强单注寻找
        let bestCombo: {
          red: string[];
          blue: string[];
          redHit: number;
          blueHit: number;
          prize: string;
          prizeMoney: number;
          issueNumber: string;
        } | null = null;

        for (const pred of predictions) {
          const combos = typeof pred.predictedNumbers === "string" 
            ? JSON.parse(pred.predictedNumbers) 
            : pred.predictedNumbers;
          
          const hits = pred.hitDetail 
            ? (typeof pred.hitDetail === "string" ? JSON.parse(pred.hitDetail) : pred.hitDetail) 
            : null;

          if (Array.isArray(combos) && Array.isArray(hits)) {
            combos.forEach((combo: any, idx: number) => {
              const hit = hits[idx];
              if (!hit) return;

              totalRedHits += hit.redHit || 0;
              totalBlueHits += hit.blueHit || 0;

              let prizeMoney = 0;

              if (hit.isWinner) {
                winningBets++;
                const prizeName = hit.prize || "其它";
                prizeDistribution[prizeName] = (prizeDistribution[prizeName] || 0) + 1;

                // 尝试从真实开奖数据中查找该奖级的金额
                const drawResult = resultsMap.get(pred.issueNumber);
                if (drawResult && drawResult.prizeAmounts) {
                  const amounts = typeof drawResult.prizeAmounts === "string"
                    ? JSON.parse(drawResult.prizeAmounts)
                    : drawResult.prizeAmounts;
                  if (Array.isArray(amounts)) {
                    const matchedPrize = amounts.find((a: any) => a.level === prizeName || (prizeName.includes("等奖") && a.level.includes(prizeName.replace("等奖", ""))));
                    if (matchedPrize && matchedPrize.amount) {
                      const amtNum = parseFloat(String(matchedPrize.amount).replace(/,/g, ''));
                      if (!isNaN(amtNum)) {
                        prizeMoney = amtNum;
                      }
                    }
                  }
                }

                totalPrizeMoney += prizeMoney;
              }

              // 评判“最强”的策略：先比匹配红球数，若一样比蓝球数，若一样比奖级是否为Winner
              const isCurrentBetter = !bestCombo || 
                (hit.redHit + hit.blueHit > bestCombo.redHit + bestCombo.blueHit) ||
                (hit.redHit + hit.blueHit === bestCombo.redHit + bestCombo.blueHit && hit.isWinner && !bestCombo.prize.includes("中奖"));

              if (isCurrentBetter) {
                const sortedRed = [...(combo.red || [])].sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
                const sortedBlue = [...(combo.blue || [])].sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
                bestCombo = {
                  red: sortedRed,
                  blue: sortedBlue,
                  redHit: hit.redHit || 0,
                  blueHit: hit.blueHit || 0,
                  prize: hit.prize || "未中奖",
                  prizeMoney,
                  issueNumber: pred.issueNumber,
                };
              }
            });
          }
        }

        const winRate = totalBets > 0 ? parseFloat(((winningBets / totalBets) * 100).toFixed(2)) : 0;

        return {
          totalPredictions,
          totalBets,
          winningBets,
          winRate,
          totalRedHits,
          totalBlueHits,
          totalPrizeMoney,
          prizeDistribution,
          bestCombo,
        };
      } catch (err) {
        console.error("[AI Route] 获取预测战绩统计异常:", err);
        throw new Error("获取历史战绩失败");
      }
    }),
});

