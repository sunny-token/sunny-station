import { NextRequest, NextResponse } from "next/server";
import { appRouter } from "@/server";
import { createCallerFactory } from "@/server/trpc";

/**
 * Cron job endpoint for DLT crawler
 * This endpoint is called by Vercel Cron Jobs every day at 7 AM
 *
 * To verify the request is from Vercel Cron, you can check the Authorization header:
 * Authorization: Bearer <your-cron-secret>
 */
const createCaller = createCallerFactory(appRouter);

export async function GET(req: NextRequest) {
  try {
    // 验证请求是否来自 Vercel Cron（可选，但推荐）
    // 如果设置了 CRON_SECRET，则必须提供正确的 Authorization header
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      // 只有在设置了 CRON_SECRET 时才验证
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
    }
    // 如果没有设置 CRON_SECRET，则允许直接访问（方便测试）

    // 直接调用 tRPC 方法，复用代码
    const caller = createCaller({});
    const currentYear = new Date().getFullYear().toString();
    const result = await caller.dlt.fetchAndSave({ year: currentYear });

    return NextResponse.json({
      success: result.success,
      count: result.count,
      message: `Cron job executed successfully. Added ${result.count} new records.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

