const defaultFallbackModels = [
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

  for (const model of fallbackModels) {
    try {
      const isOfficialGemini = model.endsWith("-official");
      const actualModel = model.replace("-official", "");
      const isGemini = actualModel.includes("gemini");
      const isClaude = actualModel.includes("claude");
      
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
          console.warn(`[AI Service] 模型 ${model} 请求失败, 状态码: ${response.status}, 详情: ${errorText}`);
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
