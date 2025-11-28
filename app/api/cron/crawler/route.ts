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

/**
 * 检查昨天是否有开奖结果（已开奖）
 * @param lotteryType 彩票类型 'dlt' | 'ssq'
 * @returns 如果有昨天的开奖结果返回 true，否则返回 false
 */
async function hasYesterdayResult(
  lotteryType: "dlt" | "ssq",
): Promise<boolean> {
  const prisma = prismaService.getPrismaClient();

  // 计算昨天的日期（本地时区）
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // 计算昨天的结束时间
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayDateStr = yesterday.toISOString().split("T")[0];
  console.log(
    `[CRON] [${lotteryType.toUpperCase()}] 检查昨天 (${yesterdayDateStr}) 是否有开奖结果...`,
  );

  // 查询昨天的开奖结果
  let result: any = null;
  if (lotteryType === "ssq") {
    result = await prisma.sSQResult.findFirst({
      where: {
        openDate: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
      orderBy: { issueNumber: "desc" },
    });
  } else {
    result = await prisma.dLTResult.findFirst({
      where: {
        openDate: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
      orderBy: { issueNumber: "desc" },
    });
  }

  if (!result) {
    console.log(`[CRON] [${lotteryType.toUpperCase()}] 昨天没有开奖结果记录`);
    return false;
  }

  // 检查是否已开奖（openNumbers 不为空且有 red 字段）
  const openNumbers =
    typeof result.openNumbers === "string"
      ? JSON.parse(result.openNumbers)
      : result.openNumbers;

  const hasOpened =
    openNumbers && openNumbers.red && openNumbers.red.length > 0;

  if (hasOpened) {
    console.log(
      `[CRON] [${lotteryType.toUpperCase()}] ✅ 昨天已有开奖结果 (期号: ${result.issueNumber}, 开奖日期: ${result.openDate.toISOString().split("T")[0]})`,
    );
    return true;
  } else {
    console.log(
      `[CRON] [${lotteryType.toUpperCase()}] ⚠️  昨天有记录但尚未开奖 (期号: ${result.issueNumber})`,
    );
    return false;
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

    // 根据今天是周几决定要处理的彩票类型
    // 开奖日：大乐透(1,3,6) 双色球(2,4,0)
    // 匹配日（延后一天）：大乐透(2,4,0) 双色球(1,3,5)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = 周日, 1 = 周一, ..., 6 = 周六

    let targetLotteryType: "dlt" | "ssq" | null = null;
    if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 0) {
      // 周二、周四、周日：处理大乐透（昨天是周一、周三、周六，大乐透开奖）
      targetLotteryType = "dlt";
      console.log(
        `[CRON] 今天是周${["日", "一", "二", "三", "四", "五", "六"][dayOfWeek]}，处理大乐透`,
      );
    } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      // 周一、周三、周五：处理双色球（昨天是周日、周二、周四，双色球开奖）
      targetLotteryType = "ssq";
      console.log(
        `[CRON] 今天是周${["日", "一", "二", "三", "四", "五", "六"][dayOfWeek]}，处理双色球`,
      );
    } else {
      // 周六：不处理任何类型
      console.log("[CRON] 今天（周六）不处理任何彩票类型");
      return NextResponse.json({
        success: true,
        message: "Saturday - no lottery processing needed",
        timestamp,
        duration: {
          crawl: 0,
          total: Date.now() - startTime,
        },
      });
    }

    // 检查昨天是否有对应类型的开奖结果
    console.log(
      `[CRON] 检查昨天是否有${targetLotteryType === "ssq" ? "双色球" : "大乐透"}开奖结果...`,
    );
    const hasYesterday = await hasYesterdayResult(targetLotteryType);

    // 执行爬取任务（如果昨天没有开奖结果才执行）
    console.log(
      `[CRON] 开始执行${targetLotteryType === "ssq" ? "双色球" : "大乐透"}爬取任务...`,
    );
    const crawlStartTime = Date.now();

    let crawlResult: {
      success: boolean;
      count?: number;
      skipped?: boolean;
    };

    if (hasYesterday) {
      console.log(
        `[CRON] [${targetLotteryType.toUpperCase()}] ⏭️  跳过爬取（昨天已有开奖结果）`,
      );
      crawlResult = {
        success: true,
        count: 0,
        skipped: true,
      };
    } else {
      const taskStartTime = Date.now();
      console.log(`[CRON] [${targetLotteryType.toUpperCase()}] 开始爬取...`);
      try {
        const result =
          targetLotteryType === "ssq"
            ? await caller.ssq.fetchAndSave({ year: currentYear })
            : await caller.dlt.fetchAndSave({ year: currentYear });
        const duration = Date.now() - taskStartTime;
        console.log(
          `[CRON] [${targetLotteryType.toUpperCase()}] ✅ 完成 - 成功: ${result.success}, 新增: ${result.count || 0} 条, 耗时: ${duration}ms`,
        );
        crawlResult = result;
      } catch (error) {
        const duration = Date.now() - taskStartTime;
        console.error(
          `[CRON] [${targetLotteryType.toUpperCase()}] ❌ 失败 - 耗时: ${duration}ms, 错误:`,
          error,
        );
        throw error;
      }
    }

    const crawlDuration = Date.now() - crawlStartTime;
    const totalCount = crawlResult.count || 0;
    const allSuccess = crawlResult.success;

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
    const lotteryName = targetLotteryType === "ssq" ? "双色球" : "大乐透";
    const status = (crawlResult as any).skipped
      ? "⏭️  跳过"
      : crawlResult.success
        ? "✅"
        : "❌";
    console.log(
      `  ${lotteryName}: ${status} ${(crawlResult as any).skipped ? "(昨天已有开奖结果)" : `${totalCount} 条`}`,
    );
    console.log(`  总计: ${totalCount} 条新记录`);
    console.log(`  爬取耗时: ${crawlDuration}ms`);
    console.log(`  匹配耗时: ${matchDuration}ms`);
    console.log(`  总耗时: ${totalDuration}ms`);
    console.log(`  状态: ${allSuccess ? "✅ 成功" : "❌ 失败"}`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: allSuccess,
      [targetLotteryType]: {
        success: crawlResult.success,
        count: totalCount,
        skipped: (crawlResult as any).skipped || false,
      },
      totalCount,
      message: `Cron job executed successfully. ${lotteryName}: ${(crawlResult as any).skipped ? "skipped" : `added ${totalCount} new records`}.`,
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
 * 开奖日：大乐透(1,3,6) 双色球(2,4,0)
 * 匹配日（延后一天）：大乐透(2,4,0) 双色球(3,5,1)
 * 周二、周四、周日：匹配大乐透（因为昨天是周一、周三、周六，大乐透开奖）
 * 周一、周三、周五：匹配双色球（因为昨天是周日、周二、周四，双色球开奖）
 */
async function checkAndNotifyWinners() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = 周日, 1 = 周一, ..., 6 = 周六

  // 确定今天要匹配的彩票类型（延后一天匹配）
  let lotteryType: "ssq" | "dlt" | null = null;
  if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 0) {
    // 周二、周四、周日：匹配大乐透（昨天是周一、周三、周六，大乐透开奖）
    lotteryType = "dlt";
    console.log(
      "[CRON] [MATCH] 今天是周" +
        ["日", "一", "二", "三", "四", "五", "六"][dayOfWeek] +
        "，匹配大乐透（昨天大乐透开奖）",
    );
  } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
    // 周一、周三、周五：匹配双色球（昨天是周日、周二、周四，双色球开奖）
    lotteryType = "ssq";
    console.log(
      "[CRON] [MATCH] 今天是周" +
        ["日", "一", "二", "三", "四", "五", "六"][dayOfWeek] +
        "，匹配双色球（昨天双色球开奖）",
    );
  } else {
    // 周六不匹配（昨天周五没有开奖）
    console.log("[CRON] [MATCH] 今天（周六）不匹配任何彩票类型");
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
  let openNumbers =
    typeof latestResult.openNumbers === "string"
      ? JSON.parse(latestResult.openNumbers)
      : latestResult.openNumbers;

  if (!openNumbers || !openNumbers.red || openNumbers.red.length === 0) {
    console.log(`[CRON] [MATCH] 最新期号 ${latestResult.issueNumber} 尚未开奖`);
    return;
  }

  // 修复数据格式：双色球的 blue 可能是字符串，需要转换为数组
  if (lotteryType === "ssq" && typeof openNumbers.blue === "string") {
    openNumbers = {
      ...openNumbers,
      blue: [openNumbers.blue],
    };
    console.log(
      `[CRON] [MATCH] 修复双色球 blue 格式: "${openNumbers.blue[0]}" -> ["${openNumbers.blue[0]}"]`,
    );
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
