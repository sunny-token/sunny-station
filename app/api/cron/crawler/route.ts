import { NextRequest, NextResponse } from "next/server";
import { appRouter } from "@/server";
import { createCallerFactory } from "@/server/trpc";
import prismaService from "@/lib/prismaService";
import { checkWin, type TicketNumbers } from "@/lib/lotteryRules";

/**
 * Unified cron job endpoint for both DLT and SSQ crawlers
 * This endpoint is called by Vercel Cron Jobs every day at 7 AM
 *
 * To verify the request is from Vercel Cron, you can check the Authorization header:
 * Authorization: Bearer <your-cron-secret>
 */
const createCaller = createCallerFactory(appRouter);

// 防重复发送邮件的缓存：记录已发送的期号
// key: `${lotteryType}-${issueNumber}`
const sentEmailCache = new Set<string>();

// 清理过期的缓存（保留最近24小时的记录）
function cleanupEmailCache() {
  // 这个缓存会在服务器重启时清空，所以不需要复杂的过期机制
  // 如果缓存太大（超过1000条），清空它
  if (sentEmailCache.size > 1000) {
    sentEmailCache.clear();
    console.log("[CRON] [MATCH] 清理邮件发送缓存");
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log("=".repeat(60));
  console.log(`[CRON] 定时任务开始执行 - ${timestamp}`);
  console.log("=".repeat(60));

  try {
    // 验证请求是否来自 Vercel Cron（可选，但推荐）
    // 如果设置了 CRON_SECRET，则必须提供正确的 Authorization header
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      console.log("[CRON] 检测到 CRON_SECRET，进行身份验证...");
      // 只有在设置了 CRON_SECRET 时才验证
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error("[CRON] ❌ 身份验证失败: Authorization header 不匹配");
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      console.log("[CRON] ✅ 身份验证通过");
    } else {
      console.log("[CRON] ⚠️  未设置 CRON_SECRET，跳过身份验证（测试模式）");
    }

    // 直接调用 tRPC 方法，复用代码
    const caller = createCaller({});
    const currentYear = new Date().getFullYear().toString();
    console.log(`[CRON] 目标年份: ${currentYear}`);

    // 并行执行两个爬取任务
    console.log("[CRON] 开始并行执行爬取任务...");
    const crawlStartTime = Date.now();

    const [dltResult, ssqResult] = await Promise.all([
      (async () => {
        const taskStartTime = Date.now();
        console.log("[CRON] [DLT] 开始爬取...");
        try {
          const result = await caller.dlt.fetchAndSave({ year: currentYear });
          const duration = Date.now() - taskStartTime;
          console.log(
            `[CRON] [DLT] ✅ 完成 - 成功: ${result.success}, 新增: ${result.count || 0} 条, 耗时: ${duration}ms`,
          );
          return result;
        } catch (error) {
          const duration = Date.now() - taskStartTime;
          console.error(
            `[CRON] [DLT] ❌ 失败 - 耗时: ${duration}ms, 错误:`,
            error,
          );
          throw error;
        }
      })(),
      (async () => {
        const taskStartTime = Date.now();
        console.log("[CRON] [SSQ] 开始爬取...");
        try {
          const result = await caller.ssq.fetchAndSave({ year: currentYear });
          const duration = Date.now() - taskStartTime;
          console.log(
            `[CRON] [SSQ] ✅ 完成 - 成功: ${result.success}, 新增: ${result.count || 0} 条, 耗时: ${duration}ms`,
          );
          return result;
        } catch (error) {
          const duration = Date.now() - taskStartTime;
          console.error(
            `[CRON] [SSQ] ❌ 失败 - 耗时: ${duration}ms, 错误:`,
            error,
          );
          throw error;
        }
      })(),
    ]);

    const crawlDuration = Date.now() - crawlStartTime;
    const totalCount = (dltResult.count || 0) + (ssqResult.count || 0);
    const allSuccess = dltResult.success && ssqResult.success;

    // 中奖匹配和邮件通知
    console.log("-".repeat(60));
    console.log("[CRON] 🎯 开始中奖匹配检查...");
    const matchStartTime = Date.now();

    try {
      await checkAndNotifyWinners();
    } catch (error) {
      console.error("[CRON] ❌ 中奖匹配检查失败:", error);
      // 不中断整个流程，只记录错误
    }

    const matchDuration = Date.now() - matchStartTime;
    const totalDuration = Date.now() - startTime;

    console.log("-".repeat(60));
    console.log("[CRON] 📊 执行结果汇总:");
    console.log(
      `  DLT: ${dltResult.success ? "✅" : "❌"} ${dltResult.count || 0} 条`,
    );
    console.log(
      `  SSQ: ${ssqResult.success ? "✅" : "❌"} ${ssqResult.count || 0} 条`,
    );
    console.log(`  总计: ${totalCount} 条新记录`);
    console.log(`  爬取耗时: ${crawlDuration}ms`);
    console.log(`  匹配耗时: ${matchDuration}ms`);
    console.log(`  总耗时: ${totalDuration}ms`);
    console.log(`  状态: ${allSuccess ? "✅ 成功" : "❌ 部分失败"}`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: allSuccess,
      dlt: {
        success: dltResult.success,
        count: dltResult.count || 0,
      },
      ssq: {
        success: ssqResult.success,
        count: ssqResult.count || 0,
      },
      totalCount,
      message: `Cron job executed successfully. Added ${totalCount} new records (DLT: ${dltResult.count || 0}, SSQ: ${ssqResult.count || 0}).`,
      timestamp,
      duration: {
        crawl: crawlDuration,
        total: totalDuration,
      },
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error("=".repeat(60));
    console.error(`[CRON] ❌ 定时任务执行失败 - 总耗时: ${totalDuration}ms`);
    console.error("[CRON] 错误详情:", error);
    if (error instanceof Error) {
      console.error("[CRON] 错误消息:", error.message);
      console.error("[CRON] 错误堆栈:", error.stack);
    }
    console.error("=".repeat(60));

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        duration: {
          total: totalDuration,
        },
      },
      { status: 500 },
    );
  }
}

/**
 * 检查中奖并发送邮件通知
 * 周一、周三、周六：匹配大乐透
 * 周二、周四、周日：匹配双色球
 */
async function checkAndNotifyWinners() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = 周日, 1 = 周一, ..., 6 = 周六

  // 确定今天要匹配的彩票类型
  let lotteryType: "ssq" | "dlt" | null = null;
  if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 6) {
    // 周一、周三、周六：大乐透
    lotteryType = "dlt";
    console.log(
      "[CRON] [MATCH] 今天是周" +
        ["日", "一", "二", "三", "四", "五", "六"][dayOfWeek] +
        "，匹配大乐透",
    );
  } else if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 0) {
    // 周二、周四、周日：双色球
    lotteryType = "ssq";
    console.log(
      "[CRON] [MATCH] 今天是周" +
        ["日", "一", "二", "三", "四", "五", "六"][dayOfWeek] +
        "，匹配双色球",
    );
  } else {
    console.log("[CRON] [MATCH] 今天（周五）不匹配任何彩票类型");
    return;
  }

  const prisma = prismaService.getPrismaClient();

  // 获取最新的开奖结果
  let latestResult: any;
  if (lotteryType === "ssq") {
    latestResult = await prisma.sSQResult.findFirst({
      orderBy: { issueNumber: "desc" },
    });
  } else {
    latestResult = await prisma.dLTResult.findFirst({
      orderBy: { issueNumber: "desc" },
    });
  }

  if (!latestResult) {
    console.log(
      `[CRON] [MATCH] 未找到最新的${lotteryType === "ssq" ? "双色球" : "大乐透"}开奖结果`,
    );
    return;
  }

  // 检查是否已经开奖（开奖号码不为空）
  const openNumbers =
    typeof latestResult.openNumbers === "string"
      ? JSON.parse(latestResult.openNumbers)
      : latestResult.openNumbers;

  if (!openNumbers || !openNumbers.red || openNumbers.red.length === 0) {
    console.log(`[CRON] [MATCH] 最新期号 ${latestResult.issueNumber} 尚未开奖`);
    return;
  }

  console.log(
    `[CRON] [MATCH] 检查期号: ${latestResult.issueNumber}, 开奖日期: ${latestResult.openDate}`,
  );

  // 检查是否已经发送过邮件（防重复发送）
  // 方法1: 使用内存缓存（在同一实例内有效）
  const emailCacheKey = `${lotteryType}-${latestResult.issueNumber}`;
  if (sentEmailCache.has(emailCacheKey)) {
    console.log(
      `[CRON] [MATCH] ⚠️  期号 ${latestResult.issueNumber} 的邮件已发送过（内存缓存），跳过重复发送`,
    );
    return;
  }

  // 方法2: 检查开奖结果的创建时间
  // 如果开奖结果是在最近5分钟内创建的，可能是重复的 cron 调用，跳过
  const resultAge = Date.now() - new Date(latestResult.createdAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  if (resultAge < fiveMinutes) {
    console.log(
      `[CRON] [MATCH] ⚠️  开奖结果 ${latestResult.issueNumber} 创建于 ${Math.round(resultAge / 1000)} 秒前，可能是重复调用，跳过邮件发送`,
    );
    // 仍然记录到缓存，防止短时间内重复发送
    sentEmailCache.add(emailCacheKey);
    return;
  }

  // 获取所有激活的预设号码
  const tickets = await prisma.ticket.findMany({
    where: {
      lotteryType,
      isActive: true,
    },
  });

  if (tickets.length === 0) {
    console.log(
      `[CRON] [MATCH] 没有激活的${lotteryType === "ssq" ? "双色球" : "大乐透"}预设号码`,
    );
    return;
  }

  console.log(`[CRON] [MATCH] 找到 ${tickets.length} 个预设号码，开始匹配...`);

  // 获取所有激活的收件人
  const recipients = await prisma.emailRecipient.findMany({
    where: { isActive: true },
  });

  if (recipients.length === 0) {
    console.log("[CRON] [MATCH] ⚠️  没有激活的邮件收件人，跳过邮件发送");
  }

  const winnerTickets: Array<{
    ticket: any;
    matchResult: ReturnType<typeof checkWin>;
  }> = [];

  // 检查每个预设号码
  for (const ticket of tickets) {
    const ticketNumbers =
      typeof ticket.numbers === "string"
        ? JSON.parse(ticket.numbers)
        : ticket.numbers;

    const matchResult = checkWin(
      lotteryType,
      ticketNumbers as TicketNumbers,
      openNumbers as TicketNumbers,
    );

    if (matchResult.isWinner) {
      winnerTickets.push({ ticket, matchResult });
      console.log(
        `[CRON] [MATCH] ✅ 中奖！预设号码 "${ticket.name}" (ID: ${ticket.id}) - ${matchResult.prizeLevels[0]?.name || "中奖"}`,
      );
    }
  }

  if (winnerTickets.length === 0) {
    console.log("[CRON] [MATCH] 本次检查无中奖号码");
    return;
  }

  console.log(`[CRON] [MATCH] 🎉 发现 ${winnerTickets.length} 个中奖号码！`);

  // 发送邮件通知（合并所有中奖号码到一封邮件）
  if (recipients.length > 0) {
    const recipientEmails = recipients.map((r) => r.email);
    console.log(
      `[CRON] [MATCH] 📧 准备发送邮件到 ${recipientEmails.length} 个收件人...`,
    );

    // 合并所有中奖信息到一封邮件
    const { sendMultipleWinnersNotifications, parsePrizeDetails } =
      await import("@/lib/emailService");

    // 获取中奖金额信息：优先使用 prizeAmounts 字段，如果没有则从 detail 解析
    let prizeDetails: Record<string, string> = {};

    if (latestResult.prizeAmounts) {
      // 从 prizeAmounts 字段获取（数组格式）
      try {
        const prizeAmountsArray = Array.isArray(latestResult.prizeAmounts)
          ? latestResult.prizeAmounts
          : JSON.parse(latestResult.prizeAmounts as string);

        if (Array.isArray(prizeAmountsArray)) {
          prizeAmountsArray.forEach(
            (item: { level: string; amount: string }) => {
              if (item.level && item.amount) {
                prizeDetails[item.level] = item.amount;
              }
            },
          );
        }
        console.log(
          `[CRON] [MATCH] 从 prizeAmounts 字段获取奖项信息: ${Object.keys(prizeDetails).length} 个奖项`,
        );
      } catch (error) {
        console.error(`[CRON] [MATCH] 解析 prizeAmounts 失败:`, error);
      }
    }

    // 如果 prizeAmounts 为空，尝试从 detail 字段解析
    if (Object.keys(prizeDetails).length === 0) {
      console.log(
        `[CRON] [MATCH] prizeAmounts 为空，尝试从 detail 字段解析...`,
      );
      prizeDetails = parsePrizeDetails(latestResult.detail || "");
      console.log(
        `[CRON] [MATCH] 从 detail 字段解析出 ${Object.keys(prizeDetails).length} 个奖项`,
      );
    }

    const multipleNotification = {
      lotteryType,
      issueNumber: latestResult.issueNumber,
      openDate: latestResult.openDate.toISOString().split("T")[0],
      openNumbers,
      jackpot: latestResult.jackpot || undefined,
      prizeDetails:
        Object.keys(prizeDetails).length > 0 ? prizeDetails : undefined,
      winners: winnerTickets.map(({ ticket, matchResult }) => ({
        ticketName: ticket.name,
        matchResult,
      })),
    };

    console.log(
      `[CRON] [MATCH] 📧 准备发送合并邮件 - ${winnerTickets.length} 个中奖号码，${recipientEmails.length} 个收件人`,
    );
    console.log(
      `[CRON] [MATCH] 📧 中奖金额信息: ${Object.keys(prizeDetails).length > 0 ? JSON.stringify(prizeDetails) : "无"}`,
    );

    // 只发送一次合并邮件
    const emailResult = await sendMultipleWinnersNotifications(
      recipientEmails,
      multipleNotification,
    );

    // 记录已发送的期号（防止重复发送）
    if (emailResult.success > 0) {
      sentEmailCache.add(emailCacheKey);
      cleanupEmailCache();
      console.log(
        `[CRON] [MATCH] 📧 已记录期号 ${latestResult.issueNumber} 的邮件发送状态`,
      );
    }

    console.log(
      `[CRON] [MATCH] 📧 合并邮件发送完成 - 共 ${winnerTickets.length} 个中奖号码: 成功 ${emailResult.success} 个，失败 ${emailResult.failed} 个`,
    );
  } else {
    console.log("[CRON] [MATCH] ⚠️  无收件人，跳过邮件发送");
  }
}
