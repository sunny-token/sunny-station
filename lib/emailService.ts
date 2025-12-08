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

interface WinnerNotification {
  lotteryType: "ssq" | "dlt";
  issueNumber: string;
  openDate: string;
  ticketName: string;
  matchResult: MatchResult;
  openNumbers: {
    red: string[];
    blue: string[];
  };
  jackpot?: string;
  prizeDetails?: Record<string, string>; // 各等奖的金额信息
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
 * 将 parsePrizeDetails 的结果转换为数组格式
 * 用于存储到数据库的 prizeAmounts 字段
 * @param prizeDetails Record<string, string> 格式的奖项奖金数据
 * @returns 数组格式 [{ level: "一等奖", amount: "5000000" }, ...]
 */
export function convertPrizeDetailsToArray(
  prizeDetails: Record<string, string>,
): Array<{ level: string; amount: string }> {
  return Object.entries(prizeDetails).map(([level, amount]) => ({
    level,
    amount,
  }));
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
 * 生成中奖通知邮件 HTML 内容
 */
function generateWinnerEmailHTML(notification: WinnerNotification): string {
  const {
    lotteryType,
    issueNumber,
    openDate,
    ticketName,
    matchResult,
    openNumbers,
    jackpot,
    prizeDetails,
  } = notification;
  const lotteryName = lotteryType === "ssq" ? "双色球" : "大乐透";
  const highestPrize = matchResult.prizeLevels[0];

  // 调试日志
  console.log(
    `[EMAIL] 生成单个中奖邮件 - 期号: ${issueNumber}, prizeDetails: ${prizeDetails ? JSON.stringify(prizeDetails) : "无"}`,
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #ff6b6b;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #ff6b6b;
      margin: 0;
      font-size: 28px;
    }
    .prize-badge {
      display: inline-block;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 18px;
      font-weight: bold;
      margin: 10px 0;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background-color: #f9f9f9;
      border-radius: 6px;
      border-left: 4px solid #4ecdc4;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 15px;
    }
    .numbers {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .number-ball {
      display: inline-block;
      width: 40px;
      height: 40px;
      line-height: 40px;
      text-align: center;
      border-radius: 50%;
      font-weight: bold;
      color: white;
    }
    .red-ball {
      background-color: #e74c3c;
    }
    .blue-ball {
      background-color: #3498db;
    }
    .match-info {
      background-color: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    .prize-levels {
      margin: 15px 0;
    }
    .prize-item {
      background-color: white;
      padding: 12px;
      margin: 8px 0;
      border-radius: 4px;
      border-left: 3px solid #4ecdc4;
    }
    .prize-name {
      font-weight: bold;
      color: #27ae60;
      font-size: 16px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #7f8c8d;
      font-size: 12px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-label {
      font-weight: bold;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .number-comparison {
      display: flex;
      gap: 20px;
      margin: 20px 0;
    }
    .number-group {
      flex: 1;
      padding: 15px;
      background-color: white;
      border-radius: 6px;
      border: 2px solid #e0e0e0;
    }
    .number-group-title {
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #4ecdc4;
    }
    .number-group.open {
      border-color: #4ecdc4;
    }
    .number-group.yours {
      border-color: #27ae60;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 恭喜中奖！</h1>
      <div class="prize-badge">${highestPrize.name}</div>
    </div>

    <div class="section">
      <div class="section-title">📋 开奖信息</div>
      <div class="info-row">
        <span class="info-label">彩票类型：</span>
        <span class="info-value">${lotteryName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">期号：</span>
        <span class="info-value">${issueNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">开奖日期：</span>
        <span class="info-value">${openDate}</span>
      </div>
      ${
        jackpot
          ? `<div class="info-row">
        <span class="info-label">奖池金额：</span>
        <span class="info-value">${jackpot}</span>
      </div>`
          : ""
      }
    </div>

    <div class="section">
      <div class="section-title">🏆 中奖等级</div>
      <div class="prize-levels">
        ${matchResult.prizeLevels
          .map(
            (prize: PrizeLevel) => `
          <div class="prize-item">
            <div class="prize-name">${prize.name}</div>
            <div style="margin-top: 5px; color: #666; font-size: 14px;">
              ${prize.description}
            </div>
            <div style="margin-top: 5px; color: #999; font-size: 12px;">
              红球匹配：${prize.redMatch} 个 | 蓝球匹配：${prize.blueMatch} 个
            </div>
            ${
              notification.prizeDetails && notification.prizeDetails[prize.name]
                ? `<div style="margin-top: 8px; color: #e74c3c; font-size: 18px; font-weight: bold;">
              💰 中奖金额：${formatAmount(notification.prizeDetails[prize.name])}
            </div>`
                : ""
            }
          </div>
        `,
          )
          .join("")}
      </div>
    </div>

    ${
      notification.prizeDetails &&
      Object.keys(notification.prizeDetails).length > 0
        ? `<div class="section">
      <div class="section-title">💰 本期奖项奖金</div>
      <div class="prize-levels">
        ${Object.entries(notification.prizeDetails)
          .map(
            ([level, amount]) => `
          <div class="prize-item">
            <div class="prize-name">${level}</div>
            <div style="margin-top: 8px; color: #e74c3c; font-size: 18px; font-weight: bold;">
              ${formatAmount(amount)}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>`
        : ""
    }

    <div class="section">
      <div class="section-title">🎱 号码对比</div>
      <div class="number-comparison">
        <div class="number-group open">
          <div class="number-group-title">🎱 开奖号码</div>
          <div style="margin-bottom: 15px;">
            <strong>红球：</strong>
            <div class="numbers">
              ${openNumbers.red.map((n) => `<span class="number-ball red-ball">${n.padStart(2, "0")}</span>`).join("")}
            </div>
          </div>
          <div>
            <strong>蓝球：</strong>
            <div class="numbers">
              ${openNumbers.blue.map((n) => `<span class="number-ball blue-ball">${n.padStart(2, "0")}</span>`).join("")}
            </div>
          </div>
        </div>
        <div class="number-group yours">
          <div class="number-group-title">🎫 您的号码</div>
          <div style="margin-bottom: 8px; font-size: 13px; color: #666;">
            <strong>预设名称：</strong> ${ticketName}
          </div>
          <div style="margin-bottom: 15px;">
            <strong>红球：</strong>
            <div class="numbers">
              ${matchResult.ticketNumbers.red.map((n) => `<span class="number-ball red-ball">${n.padStart(2, "0")}</span>`).join("")}
            </div>
          </div>
          <div>
            <strong>蓝球：</strong>
            <div class="numbers">
              ${matchResult.ticketNumbers.blue.map((n) => `<span class="number-ball blue-ball">${n.padStart(2, "0")}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="match-info">
      <div class="section-title">✅ 匹配结果</div>
      <div class="info-row">
        <span class="info-label">红球匹配：</span>
        <span class="info-value">${matchResult.redMatch} 个</span>
      </div>
      <div class="info-row">
        <span class="info-label">蓝球匹配：</span>
        <span class="info-value">${matchResult.blueMatch} 个</span>
      </div>
    </div>

    <div class="footer">
      <p>此邮件由彩票爬虫系统自动发送</p>
      <p>请及时核对中奖信息，祝您好运！</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 发送中奖通知邮件
 */
export async function sendWinnerNotification(
  recipientEmail: string,
  notification: WinnerNotification,
): Promise<boolean> {
  const config = getEmailConfig();
  if (!config) {
    console.warn(`[EMAIL] 跳过发送邮件到 ${recipientEmail}：邮件配置不完整`);
    return false;
  }

  try {
    // 使用 Node.js 内置的邮件发送（需要安装 nodemailer 或使用其他邮件服务）
    // 这里我们使用 fetch API 调用邮件服务 API，或者使用 nodemailer
    // 为了简化，我们使用一个通用的邮件发送方法

    const emailHTML = generateWinnerEmailHTML(notification);
    const lotteryName =
      notification.lotteryType === "ssq" ? "双色球" : "大乐透";
    const subject = `🎉 ${lotteryName}中奖通知 - ${notification.issueNumber}期 - ${notification.matchResult.prizeLevels[0]?.name || "中奖"}`;

    // 如果使用 SMTP，需要安装 nodemailer
    // 这里提供一个使用 nodemailer 的实现示例
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipientEmail,
      subject,
      html: emailHTML,
      text: `恭喜中奖！${lotteryName} ${notification.issueNumber}期，中奖等级：${notification.matchResult.prizeLevels[0]?.name || "中奖"}`,
    });

    console.log(
      `[EMAIL] ✅ 邮件发送成功到 ${recipientEmail}，MessageId: ${info.messageId}`,
    );
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ 发送邮件到 ${recipientEmail} 失败:`, error);
    return false;
  }
}

/**
 * 批量发送中奖通知（单个中奖号码）
 */
export async function sendWinnerNotifications(
  recipientEmails: string[],
  notification: WinnerNotification,
): Promise<{ success: number; failed: number }> {
  const results = await Promise.allSettled(
    recipientEmails.map((email) => sendWinnerNotification(email, notification)),
  );

  const success = results.filter(
    (r) => r.status === "fulfilled" && r.value,
  ).length;
  const failed = recipientEmails.length - success;

  return { success, failed };
}

/**
 * 生成多个中奖号码的邮件 HTML 内容
 */
function generateMultipleWinnersEmailHTML(
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
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #ff6b6b;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #ff6b6b;
      margin: 0;
      font-size: 28px;
    }
    .prize-badge {
      display: inline-block;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 18px;
      font-weight: bold;
      margin: 10px 0;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background-color: #f9f9f9;
      border-radius: 6px;
      border-left: 4px solid #4ecdc4;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 15px;
    }
    .numbers {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .number-ball {
      display: inline-block;
      width: 40px;
      height: 40px;
      line-height: 40px;
      text-align: center;
      border-radius: 50%;
      font-weight: bold;
      color: white;
    }
    .red-ball {
      background-color: #e74c3c;
    }
    .blue-ball {
      background-color: #3498db;
    }
    .winner-item {
      background-color: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 6px;
      border: 2px solid #4ecdc4;
    }
    .winner-header {
      font-size: 20px;
      font-weight: bold;
      color: #27ae60;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #4ecdc4;
    }
    .prize-item {
      background-color: #f0f9ff;
      padding: 12px;
      margin: 8px 0;
      border-radius: 4px;
      border-left: 3px solid #4ecdc4;
    }
    .prize-name {
      font-weight: bold;
      color: #27ae60;
      font-size: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-label {
      font-weight: bold;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .number-comparison {
      display: flex;
      gap: 20px;
      margin: 20px 0;
    }
    .number-group {
      flex: 1;
      padding: 15px;
      background-color: white;
      border-radius: 6px;
      border: 2px solid #e0e0e0;
    }
    .number-group-title {
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #4ecdc4;
    }
    .number-group.open {
      border-color: #4ecdc4;
    }
    .number-group.yours {
      border-color: #27ae60;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #7f8c8d;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 恭喜中奖！</h1>
      <div class="prize-badge">共 ${winners.length} 个预设号码中奖</div>
    </div>

    <div class="section">
      <div class="section-title">📋 开奖信息</div>
      <div class="info-row">
        <span class="info-label">彩票类型：</span>
        <span class="info-value">${lotteryName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">期号：</span>
        <span class="info-value">${issueNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">开奖日期：</span>
        <span class="info-value">${openDate}</span>
      </div>
      ${
        jackpot
          ? `<div class="info-row">
        <span class="info-label">奖池金额：</span>
        <span class="info-value">${jackpot}</span>
      </div>`
          : ""
      }
    </div>

    <div class="section">
      <div class="section-title">🏆 中奖详情</div>
      ${winners
        .map(
          (winner) => `
      <div class="winner-item">
        <div class="winner-header">🎫 ${winner.ticketName}</div>
        <div class="number-comparison">
          <div class="number-group open">
            <div class="number-group-title">🎱 开奖号码</div>
            <div style="margin-bottom: 15px;">
              <strong>红球：</strong>
              <div class="numbers">
                ${openNumbers.red.map((n) => `<span class="number-ball red-ball">${n.padStart(2, "0")}</span>`).join("")}
              </div>
            </div>
            <div>
              <strong>蓝球：</strong>
              <div class="numbers">
                ${openNumbers.blue.map((n) => `<span class="number-ball blue-ball">${n.padStart(2, "0")}</span>`).join("")}
              </div>
            </div>
          </div>
          <div class="number-group yours">
            <div class="number-group-title">🎫 您的号码</div>
            <div style="margin-bottom: 15px;">
              <strong>红球：</strong>
              <div class="numbers">
                ${winner.matchResult.ticketNumbers.red.map((n: string) => `<span class="number-ball red-ball">${n.padStart(2, "0")}</span>`).join("")}
              </div>
            </div>
            <div>
              <strong>蓝球：</strong>
              <div class="numbers">
                ${winner.matchResult.ticketNumbers.blue.map((n: string) => `<span class="number-ball blue-ball">${n.padStart(2, "0")}</span>`).join("")}
              </div>
            </div>
          </div>
        </div>
        <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; padding: 15px; margin: 15px 0;">
          <div class="info-row">
            <span class="info-label">红球匹配：</span>
            <span class="info-value">${winner.matchResult.redMatch} 个</span>
          </div>
          <div class="info-row">
            <span class="info-label">蓝球匹配：</span>
            <span class="info-value">${winner.matchResult.blueMatch} 个</span>
          </div>
        </div>
        <div class="prize-item">
          <div class="prize-name">${winner.matchResult.prizeLevels[0]?.name || "中奖"}</div>
          <div style="margin-top: 5px; color: #666; font-size: 14px;">
            ${winner.matchResult.prizeLevels[0]?.description || ""}
          </div>
          ${
            notification.prizeDetails &&
            notification.prizeDetails[
              winner.matchResult.prizeLevels[0]?.name || ""
            ]
              ? `<div style="margin-top: 8px; color: #e74c3c; font-size: 18px; font-weight: bold;">
            💰 中奖金额：${formatAmount(notification.prizeDetails[winner.matchResult.prizeLevels[0]?.name || ""])}
          </div>`
              : ""
          }
        </div>
      </div>
      `,
        )
        .join("")}
    </div>

    ${
      notification.prizeDetails &&
      Object.keys(notification.prizeDetails).length > 0
        ? `<div class="section">
      <div class="section-title">💰 本期奖项奖金</div>
      <div class="prize-levels">
        ${Object.entries(notification.prizeDetails)
          .map(
            ([level, amount]) => `
          <div class="prize-item">
            <div class="prize-name">${level}</div>
            <div style="margin-top: 8px; color: #e74c3c; font-size: 18px; font-weight: bold;">
              ${formatAmount(amount)}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>`
        : ""
    }

    <div class="footer">
      <p>此邮件由彩票爬虫系统自动发送</p>
      <p>请及时核对中奖信息，祝您好运！</p>
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
