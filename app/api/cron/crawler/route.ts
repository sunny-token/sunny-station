import { NextRequest, NextResponse } from "next/server";
import { appRouter } from "@/server";
import { createCallerFactory } from "@/server/trpc";

/**
 * Unified cron job endpoint for both DLT and SSQ crawlers
 * This endpoint is called by Vercel Cron Jobs every day at 7 AM
 *
 * To verify the request is from Vercel Cron, you can check the Authorization header:
 * Authorization: Bearer <your-cron-secret>
 */
const createCaller = createCallerFactory(appRouter);

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
    const totalDuration = Date.now() - startTime;

    console.log("-".repeat(60));
    console.log("[CRON] 📊 执行结果汇总:");
    console.log(`  DLT: ${dltResult.success ? "✅" : "❌"} ${dltResult.count || 0} 条`);
    console.log(`  SSQ: ${ssqResult.success ? "✅" : "❌"} ${ssqResult.count || 0} 条`);
    console.log(`  总计: ${totalCount} 条新记录`);
    console.log(`  爬取耗时: ${crawlDuration}ms`);
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

