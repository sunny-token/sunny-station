import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import prismaService from "../../lib/prismaService";

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
        const fallbackModels = [
          // GPT 系列
          "gpt-5.5",
          "gpt-5.4",
          "gpt-5.4-mini",
          
          // Claude 系列
          "claude-3-5-sonnet-20241022",
          "claude-3-opus-20240229",
          "claude-3-5-haiku-20241022",
          
          // 官方 Gemini 直连容错
          "gemini-3.5-flash-official",
          "gemini-3-flash-official",
          "gemini-3.1-flash-lite-official"
        ];
        
        let content = "";
        let lastError: any = null;

        for (const model of fallbackModels) {
          try {
            const isOfficialGemini = model.endsWith("-official");
            const actualModel = model.replace("-official", "");
            const isGemini = actualModel.includes("gemini");
            const isClaude = actualModel.includes("claude");
            
            // API Key 判断
            let currentApiKey;
            if (isOfficialGemini) {
              currentApiKey = process.env.GEMINI_API_KEY;
            } else if (isClaude) {
              currentApiKey = process.env.GPTGOD_CLAUDE_API_KEY || process.env.GPTGOD_API_KEY;
            } else {
              currentApiKey = process.env.GPTGOD_API_KEY;
            }

            if (!currentApiKey) {
              // 如果某个渠道缺少key，直接跳过使用下一个模型
              console.warn(`[AI Route] 缺少对应的 API Key，跳过模型: ${model}`);
              lastError = new Error(`缺少对应的 API Key: ${model}`);
              continue;
            }
            
            let url = "https://api.gptgod.online/v1/chat/completions";
            let headers: any = {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${currentApiKey}`
            };
            let body: any = JSON.stringify({
              model: actualModel,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.8
            });

            if (isGemini) {
              // 根据不同渠道使用对应域名
              const baseUrl = isOfficialGemini ? "https://generativelanguage.googleapis.com" : "https://api.gptgod.online";
              url = `${baseUrl}/v1beta/models/${actualModel}:generateContent?key=${currentApiKey}`;
              headers = {
                "Content-Type": "application/json"
              };
              body = JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [{ text: prompt }]
                }],
                generationConfig: {
                  temperature: 0.8
                }
              });
            } else if (isClaude) {
              url = "https://api.gptgod.online/v1/messages";
              headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentApiKey}`,
                "anthropic-version": "2023-06-01"
              };
              body = JSON.stringify({
                model: actualModel,
                max_tokens: 2048,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8
              });
            }

            const response = await fetch(url, {
              method: "POST",
              headers,
              body,
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.warn(`[AI Route] 模型 ${model} 失败 (${response.status})，尝试切换... 错误信息: ${errorText}`);
              lastError = new Error(`请求AI接口失败: ${response.statusText} (${errorText})`);
              continue;
            }

            const data = await response.json();
            
            if (isGemini) {
              content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else if (isClaude) {
              content = data.content?.[0]?.text || "";
            } else {
              content = data.choices?.[0]?.message?.content || "";
            }
            
            console.log(`[AI Route] 模型 ${model} 推演成功！`);
            // 成功则跳出重试循环
            break;
          } catch (fetchErr: any) {
            console.warn(`[AI Route] 模型 ${model} 网络异常，尝试切换...`, fetchErr.message);
            lastError = fetchErr;
            continue;
          }
        }

        if (!content) {
          throw lastError || new Error("所有可用模型均请求失败，请检查网络或配置");
        }

        // 移除深度思考模型可能带有的 <think>...</think> 标签
        content = content.replace(/<think>[\s\S]*?<\/think>/g, "");
        
        // 提取真正的 JSON 数组部分
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          content = arrayMatch[0];
        }

        // 解析 JSON
        const parsed = JSON.parse(content.replace(/```json/gi, '').replace(/```/g, '').trim());

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
      return await prisma.aIPrediction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.take,
      });
    }),
});

