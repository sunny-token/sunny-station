/**
 * 邮件发送服务
 * 使用 Node.js 内置的邮件发送功能
 */

import { MatchResult, PrizeLevel } from "./lotteryRules";

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
}


interface MultipleWinnerNotification {
  lotteryType: "ssq" | "dlt";
  issueNumber: string;
  openDate: string;
  openNumbers: {
    red: string[];
    blue: string[];
  };
  jackpot?: string;
  prizeDetails?: Record<string, string>; // 各等奖的金额信息，key 为等级名称，value 为金额
  winners: Array<{
    ticketName: string;
    matchResult: MatchResult;
  }>;
}

/**
 * 从 detail 字段解析中奖金额信息
 * detail 格式示例: "一等奖: 5,000,000元 二等奖: 200,000元 三等奖: 3,000元..."
 * 或者: "一等奖：5,000,000元 二等奖：200,000元..."
 * 或者: "一等奖5,000,000元 二等奖200,000元..."
 */
export function parsePrizeDetails(detail: string): Record<string, string> {
  const prizeDetails: Record<string, string> = {};

  if (!detail) {
    return prizeDetails;
  }

  // 匹配格式：等级名称: 金额
  // 支持多种格式：
  // 1. 一等奖: 5,000,000元
  // 2. 一等奖：5,000,000元（中文冒号）
  // 3. 一等奖 5,000,000元（空格）
  // 4. 一等奖5,000,000元（无分隔符）
  // 5. 一等奖:5,000,000元（无空格）
  const patterns = [
    /([一二三四五六七八九十]+等奖)[:：]\s*([\d,，]+)\s*元/g,
    /([一二三四五六七八九十]+等奖)\s+([\d,，]+)\s*元/g,
    /([一二三四五六七八九十]+等奖)([\d,，]+)\s*元/g,
    /([一二三四五六七八九十]+等奖)[:：]([\d,，]+)\s*元/g,
  ];

  for (const pattern of patterns) {
    let match;
    // 重置正则表达式的 lastIndex，避免全局匹配的问题
    pattern.lastIndex = 0;
    while ((match = pattern.exec(detail)) !== null) {
      const level = match[1];
      const amount = match[2].replace(/[，,]/g, ""); // 移除千位分隔符

      // 如果金额为空或无效，跳过
      if (!amount || isNaN(parseInt(amount, 10))) {
        continue;
      }

      prizeDetails[level] = amount;
    }
  }

  return prizeDetails;
}


/**
 * 格式化金额显示（添加千位分隔符）
 */
export function formatAmount(amount: string | undefined): string {
  if (!amount) return "待定";
  const num = parseInt(amount.replace(/[，,]/g, ""), 10);
  if (isNaN(num)) return amount;
  return num.toLocaleString("zh-CN") + "元";
}

/**
 * 获取邮件配置
 */
function getEmailConfig(): EmailConfig | null {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
  const fromName = process.env.SMTP_FROM_NAME || "彩票中奖通知";

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    console.warn("[EMAIL] 邮件配置不完整，跳过邮件发送");
    return null;
  }

  return {
    smtpHost,
    smtpPort: parseInt(smtpPort, 10),
    smtpUser,
    smtpPassword,
    fromEmail: fromEmail || smtpUser,
    fromName,
  };
}

/**
 * 生成多个中奖号码的邮件 HTML 内容
 */
export function generateMultipleWinnersEmailHTML(
  notification: MultipleWinnerNotification,
): string {
  const {
    lotteryType,
    issueNumber,
    openDate,
    openNumbers,
    jackpot,
    winners,
    prizeDetails,
  } = notification;
  const lotteryName = lotteryType === "ssq" ? "双色球" : "大乐透";

  // 调试日志
  console.log(
    `[EMAIL] 生成多个中奖邮件 - 期号: ${issueNumber}, prizeDetails: ${prizeDetails ? JSON.stringify(prizeDetails) : "无"}`,
  );

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1d1d1f;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 480px;
      margin: 0 auto;
      padding: 20px 16px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.05);
    }
    .header {
      padding: 32px 24px;
      background: #1d1d1f;
      color: #ffffff;
      text-align: left;
    }
    .badge {
      display: inline-block;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      background: #e30000;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 24px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .sec-title {
      font-size: 12px;
      font-weight: 600;
      color: #86868b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e8e8ed;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
      font-size: 15px;
    }
    .row:last-child {
      margin-bottom: 0;
    }
    .label {
      color: #86868b;
    }
    .value {
      font-weight: 600;
      text-align: right;
    }
    .prize-box {
      background: #fafafc;
      border: 1px solid #e8e8ed;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .prize-name {
      font-weight: 700;
      font-size: 16px;
      color: #1d1d1f;
    }
    .prize-desc {
      font-size: 13px;
      color: #86868b;
      margin-top: 4px;
      line-height: 1.4;
    }
    .prize-amount {
      font-size: 24px;
      font-weight: 700;
      color: #e30000;
      margin-top: 8px;
      letter-spacing: -0.5px;
    }
    .balls-label {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1d1d1f;
    }
    .balls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ball {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      color: #ffffff;
      background: #86868b;
    }
    .ball.red { background: #e30000; }
    .ball.blue { background: #0066cc; }
    
    .footer {
      text-align: center;
      padding: 24px 0;
      font-size: 12px;
      color: #86868b;
    }
    .footer p { margin: 4px 0; }
    
    @media only screen and (max-width: 480px) {
      .wrapper { padding: 16px 12px; }
      .title { font-size: 24px; }
      .header, .content { padding: 20px; }
      .ball { width: 32px; height: 32px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="badge">共 ${winners.length} 注获奖</div>
        <h1 class="title">您有多条中奖记录</h1>
      </div>
      
      <div class="content">
        <div class="section">
          <div class="sec-title">开奖概览</div>
          <div class="row">
            <span class="label">彩票类型</span>
            <span class="value">${lotteryName}</span>
          </div>
          <div class="row">
            <span class="label">期号</span>
            <span class="value">${issueNumber}</span>
          </div>
          <div class="row">
            <span class="label">开奖日期</span>
            <span class="value">${openDate}</span>
          </div>
          ${
            jackpot
              ? `<div class="row">
            <span class="label">奖池金额</span>
            <span class="value">${jackpot}</span>
          </div>`
              : ""
          }
        </div>

        <div class="section">
          <div class="sec-title">官方开奖号码</div>
          <div class="prize-box">
            <div class="balls">
              ${openNumbers.red.map((n) => `<div class="ball red">${n.padStart(2, "0")}</div>`).join("")}
              ${openNumbers.blue.map((n) => `<div class="ball blue">${n.padStart(2, "0")}</div>`).join("")}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="sec-title">您的中奖详情</div>
          ${winners
            .map(
              (winner) => `
            <div class="prize-box">
              <div class="balls-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: #86868b; font-size: 13px; font-weight: 500;">${winner.ticketName}</span>
                <span style="color: #e30000; font-size: 14px; font-weight: 600;">
                  ${winner.matchResult.prizeLevels[0]?.name || "中奖"}
                </span>
              </div>
              <div class="balls" style="margin-bottom: 12px;">
                ${winner.matchResult.ticketNumbers.red.map((n: string) => `<div class="ball red">${n.padStart(2, "0")}</div>`).join("")}
                ${winner.matchResult.ticketNumbers.blue.map((n: string) => `<div class="ball blue">${n.padStart(2, "0")}</div>`).join("")}
              </div>
              <div class="prize-desc">
                ${winner.matchResult.prizeLevels[0]?.description || ""}
                <br />
                匹配：红球 ${winner.matchResult.redMatch} 个 / 蓝球 ${winner.matchResult.blueMatch} 个
              </div>
              ${
                notification.prizeDetails &&
                notification.prizeDetails[
                  winner.matchResult.prizeLevels[0]?.name || ""
                ]
                  ? `<div class="prize-amount">
                  ${formatAmount(
                    notification.prizeDetails[
                      winner.matchResult.prizeLevels[0]?.name || ""
                    ],
                  )}
                </div>`
                  : ""
              }
            </div>
            `,
            )
            .join("")}
        </div>

        ${
          notification.prizeDetails &&
          Object.keys(notification.prizeDetails).length > 0
            ? `<div class="section">
          <div class="sec-title">本期所有奖项</div>
          ${Object.entries(notification.prizeDetails)
            .map(
              ([level, amount]) => `
            <div class="row">
              <span class="label">${level}</span>
              <span class="value" style="color: #e30000;">${formatAmount(amount)}</span>
            </div>
          `,
            )
            .join("")}
        </div>`
            : ""
        }
      </div>
    </div>
    
    <div class="footer">
      <p>此邮件由系统自动发送</p>
      <p>实际中奖信息以官方发布为准</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 发送多个中奖号码的合并通知邮件
 */
export async function sendMultipleWinnersNotification(
  recipientEmail: string,
  notification: MultipleWinnerNotification,
): Promise<boolean> {
  const config = getEmailConfig();
  if (!config) {
    console.error(
      `[EMAIL] ❌ 跳过发送邮件到 ${recipientEmail}：邮件配置不完整`,
    );
    console.error(`[EMAIL] 缺少的环境变量：`);
    if (!process.env.SMTP_HOST) console.error(`[EMAIL]   - SMTP_HOST`);
    if (!process.env.SMTP_PORT) console.error(`[EMAIL]   - SMTP_PORT`);
    if (!process.env.SMTP_USER) console.error(`[EMAIL]   - SMTP_USER`);
    if (!process.env.SMTP_PASSWORD) console.error(`[EMAIL]   - SMTP_PASSWORD`);
    return false;
  }

  try {
    const emailHTML = generateMultipleWinnersEmailHTML(notification);
    const lotteryName =
      notification.lotteryType === "ssq" ? "双色球" : "大乐透";
    const subject = `🎉 ${lotteryName}中奖通知 - ${notification.issueNumber}期 - 共 ${notification.winners.length} 个预设号码中奖`;

    console.log(`[EMAIL] 准备发送邮件到 ${recipientEmail}...`);
    console.log(
      `[EMAIL] SMTP配置: ${config.smtpHost}:${config.smtpPort}, 用户: ${config.smtpUser}`,
    );

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    // 验证连接
    await transporter.verify();
    console.log(`[EMAIL] ✅ SMTP 连接验证成功`);

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipientEmail,
      subject,
      html: emailHTML,
      text: `恭喜中奖！${lotteryName} ${notification.issueNumber}期，共 ${notification.winners.length} 个预设号码中奖`,
    });

    console.log(
      `[EMAIL] ✅ 合并邮件发送成功到 ${recipientEmail}，MessageId: ${info.messageId}`,
    );
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ 发送合并邮件到 ${recipientEmail} 失败:`);
    if (error instanceof Error) {
      console.error(`[EMAIL]   错误消息: ${error.message}`);
      console.error(`[EMAIL]   错误堆栈: ${error.stack}`);
    } else {
      console.error(`[EMAIL]   错误详情:`, error);
    }
    return false;
  }
}

/**
 * 批量发送多个中奖号码的合并通知
 */
export async function sendMultipleWinnersNotifications(
  recipientEmails: string[],
  notification: MultipleWinnerNotification,
): Promise<{ success: number; failed: number }> {
  const results = await Promise.allSettled(
    recipientEmails.map((email) =>
      sendMultipleWinnersNotification(email, notification),
    ),
  );

  const success = results.filter(
    (r) => r.status === "fulfilled" && r.value,
  ).length;
  const failed = recipientEmails.length - success;

  return { success, failed };
}
