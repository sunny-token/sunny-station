// 交叉排列：每一梯队包含 GPT / Claude / Gemini 各一个
// 5xx 错误 → 整个厂商可能宕机，立即跳到下一厂商
// 非 5xx 错误 → 仅该型号不可用，继续按顺序尝试
const defaultFallbackModels = [
  // 第一梯队
  "gpt-5.5",
  "claude-sonnet-4-20250514",       // 次数计费 400积分/次
  "gemini-3.5-flash-official",
  
  // 第二梯队
  "gpt-5.4",
  "claude-haiku-4-5-20251001",      // 官方 12,000积分/1M
  "gemini-3-flash-official",
  
  // 第三梯队
  "gpt-5.4-mini",
  "claude-sonnet-4-6",              // 官方 36,000积分/1M
  "gemini-3.1-flash-lite-official",
  
  // 终极兜底
  "claude-opus-4-8",                // 官方 60,000积分/1M
];

interface AICallOptions {
  prompt: string;
  base64Image?: string; // Optional image for Vision tasks
  fallbackModels?: string[];
  temperature?: number;
}

export async function callAI({
  prompt,
  base64Image,
  fallbackModels = defaultFallbackModels,
  temperature = 0.8
}: AICallOptions): Promise<string> {
  console.log(`[AI Service] 开始调用 AI, Prompt 长度: ${prompt.length}, 是否包含图片: ${!!base64Image}`);
  
  let content = "";
  let lastError: any = null;
  // 记录哪些厂商返回了 5xx，说明整个厂商服务可能宕机，后续直接跳过
  const serverErrorProviders = new Set<string>();

  for (const model of fallbackModels) {
    try {
      const isOfficialGemini = model.endsWith("-official");
      const actualModel = model.replace("-official", "");
      const isGemini = actualModel.includes("gemini");
      const isClaude = actualModel.includes("claude");
      
      // 判断当前模型属于哪个厂商
      const provider = isGemini ? "gemini" : isClaude ? "claude" : "gpt";
      
      // 如果该厂商已经 5xx 过，直接跳过
      if (serverErrorProviders.has(provider)) {
        console.log(`[AI Service] 厂商 ${provider} 已标记为宕机，跳过模型: ${model}`);
        continue;
      }
      
      let currentApiKey;
      if (isOfficialGemini) {
        currentApiKey = process.env.GEMINI_API_KEY;
      } else if (isClaude) {
        currentApiKey = process.env.GPTGOD_CLAUDE_API_KEY || process.env.GPTGOD_API_KEY;
      } else {
        currentApiKey = process.env.GPTGOD_API_KEY;
      }

      if (!currentApiKey) {
        console.warn(`[AI Service] 缺少对应的 API Key，跳过模型: ${model}`);
        lastError = new Error(`缺少 API Key，跳过模型: ${model}`);
        continue;
      }
      
      let url = "https://api.gptgod.online/v1/chat/completions";
      let headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentApiKey}`
      };
      
      let messageContent: any = prompt;
      if (base64Image) {
        messageContent = [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: base64Image } }
        ];
      }

      let body: any = JSON.stringify({
        model: actualModel,
        messages: [{ role: "user", content: messageContent }],
        temperature: temperature
      });

      if (isGemini) {
        const baseUrl = isOfficialGemini ? "https://generativelanguage.googleapis.com" : "https://api.gptgod.online";
        url = `${baseUrl}/v1beta/models/${actualModel}:generateContent?key=${currentApiKey}`;
        headers = { "Content-Type": "application/json" };
        
        const parts: any[] = [{ text: prompt }];
        if (base64Image) {
          // Extract base64 part and mime type if provided as data URI
          let mimeType = "image/jpeg";
          let base64Data = base64Image;
          const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          });
        }
        
        body = JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: temperature }
        });
      } else if (isClaude) {
        url = "https://api.gptgod.online/v1/messages";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentApiKey}`,
          "anthropic-version": "2023-06-01"
        };
        
        let claudeContent: any = prompt;
        if (base64Image) {
           let mimeType = "image/jpeg";
           let base64Data = base64Image;
           const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
           if (match) {
             mimeType = match[1];
             base64Data = match[2];
           }
           claudeContent = [
             { type: "text", text: prompt },
             { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } }
           ];
        }
        
        body = JSON.stringify({
          model: actualModel,
          max_tokens: 2048,
          messages: [{ role: "user", content: claudeContent }],
          temperature: temperature
        });
      }

      console.log(`[AI Service] 尝试使用模型进行预测: ${model}`);
      const startTime = Date.now();
      const response = await fetch(url, { method: "POST", headers, body });
      if (!response.ok) {
          const errorText = await response.text().catch(() => "N/A");
          const status = response.status;
          console.warn(`[AI Service] 模型 ${model} 请求失败, 状态码: ${status}, 详情: ${errorText}`);
          lastError = new Error(`模型 ${model} 请求失败 (${status}): ${errorText.substring(0, 200)}`);
          
          // 5xx 服务端错误：整个厂商可能宕机，拉黑该厂商
          if (status >= 500) {
            const failedProvider = isGemini ? "gemini" : isClaude ? "claude" : "gpt";
            serverErrorProviders.add(failedProvider);
            console.warn(`[AI Service] 厂商 ${failedProvider} 返回 ${status}，标记为宕机，切换到其他厂商`);
          }
          continue;
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`[AI Service] 模型 ${model} 请求成功, 耗时: ${elapsed}ms`);
      
      if (isGemini) {
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else if (isClaude) {
        content = data.content?.[0]?.text || "";
      } else {
        content = data.choices?.[0]?.message?.content || "";
      }
      
      break;
    } catch (err) {
      console.warn(`[AI Service] 模型 ${model} 请求异常:`, err);
      lastError = err;
      continue;
    }
  }

  if (!content) {
    console.error(`[AI Service] 所有模型均失败。最后错误:`, lastError);
    throw new Error("所有可用模型均请求失败，请检查网络或配置");
  }

  content = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  
  const firstBrace = content.indexOf('{');
  const firstBracket = content.indexOf('[');
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = content.lastIndexOf('}');
    if (lastBrace !== -1) content = content.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    const lastBracket = content.lastIndexOf(']');
    if (lastBracket !== -1) content = content.substring(firstBracket, lastBracket + 1);
  }
  
  console.log(`[AI Service] AI 返回内容提取成功，结果长度: ${content.length}`);
  return content;
}
