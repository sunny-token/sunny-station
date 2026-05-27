import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import prismaService from "../../lib/prismaService";

const prisma = prismaService.getPrismaClient();

export const aiRouter = router({
  predictNumbers: publicProcedure
    .input(z.object({ type: z.enum(["ssq", "dlt"]) }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.GPTGOD_API_KEY;
      if (!apiKey) {
        throw new Error("请在 .env 中配置 GPTGOD_API_KEY");
      }

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
返回要求：必须且只能返回一个合法的 JSON 数组，不要有任何其他分析文本。数组包含5个对象，每个对象结构必须为 {"red": ["xx","xx",...], "blue": ["xx",...], "reason": "简短的一句话推演理由"}，其中红球和蓝球里的数字必须补齐两位数（例如"01"），reason 字段提供该注号码的生成逻辑或冷热走势依据（约20-30字）。双色球的蓝球数组长度为1，大乐透蓝球数组长度为2。`;

      try {
        const fallbackModels = [
          "claude-sonnet-4-6",
          "claude-sonnet-4-5-20250929",
          "claude-opus-4-6",
          "claude-haiku-4-5-20251001",
          "gpt-5.5",
          "gpt-5.4",
          "gpt-5.4-mini",
          "gpt-5.3-codex",
          "gpt-5.2",
          "gpt-5.1-high",
          "gpt-5.1",
          "gpt-5.1-minimal",
          "gpt-5-high",
          "gpt-5",
          "gpt-5-minimal"
        ];
        
        let content = "";
        let lastError: any = null;

        for (const model of fallbackModels) {
          try {
            const isClaude = model.includes("claude");
            let currentApiKey = apiKey;
            
            // 如果是 Claude 模型，强制要求使用独立的 Key
            if (isClaude) {
              if (!process.env.CLAUDE_API_KEY) {
                console.warn(`[AI Route] 跳过 ${model}，因为未配置 CLAUDE_API_KEY`);
                continue;
              }
              currentApiKey = process.env.CLAUDE_API_KEY;
            }

            const url = isClaude 
              ? "https://api.gptgod.online/v1/messages" 
              : "https://api.gptgod.online/v1/chat/completions";

            const headers: any = isClaude 
              ? {
                  "Content-Type": "application/json",
                  "x-api-key": currentApiKey,
                  "anthropic-version": "2023-06-01"
                }
              : {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${currentApiKey}`
                };

            const body = isClaude 
              ? JSON.stringify({
                  model,
                  messages: [{ role: "user", content: prompt }],
                  max_tokens: 1024,
                  temperature: 0.8
                })
              : JSON.stringify({
                  model,
                  messages: [{ role: "user", content: prompt }],
                  temperature: 0.8
                });

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
            content = isClaude ? data.content[0].text : (data.choices[0].message.content || "");
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
          } else if (msg.includes("gptgod_api_key")) {
            userMessage = "AI 测算服务尚未配置访问密钥，请联系系统管理员";
          }
        }
        
        throw new Error(userMessage);
      }
    }),
});
