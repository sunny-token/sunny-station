import { publicProcedure, router } from "../trpc";
import * as cheerio from "cheerio";
import prismaService from "../../lib/prismaService";
import { z } from "zod";

// 从 getdetail 接口获取奖项奖金信息
const fetchPrizeDetails = async (
  lotid: string,
  issue: string,
): Promise<{
  prizeAmounts: Array<{ level: string; amount: string }> | null;
  prizeDetailHtml: string | null;
}> => {
  try {
    const res = await fetch("https://www.17500.cn/api/kaijiang/getdetail", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `lotid=${lotid}&issue=${issue}&isone=1`,
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // 保存原始 HTML
    const prizeDetailHtml = html;

    // 查找奖项奖金表格
    const prizeDetails: Array<{ level: string; amount: string }> = [];
    const rows = $("table tbody tr").toArray();

    for (let i = 0; i < rows.length; i++) {
      const tds = $(rows[i]).find("td");
      if (tds.length < 5) continue;

      const level = $(tds[0]).text().trim();
      const perAmountText = $(tds[2]).text().trim(); // 第3列：每注金额
      const prizeText = $(tds[4]).text().trim(); // 第5列：奖金

      // 优先使用每注金额，如果是"浮动奖"则使用每注金额
      let amountText = perAmountText;
      if (prizeText && prizeText !== "浮动奖" && /[\d,，]+/.test(prizeText)) {
        amountText = prizeText;
      }

      // 提取金额数字（移除"元"和其他文字）
      const amountMatch = amountText.match(/[\d,，]+/);
      if (level && amountMatch) {
        const amount = amountMatch[0].replace(/[，,]/g, "");
        if (amount && !isNaN(parseInt(amount, 10))) {
          prizeDetails.push({ level, amount });
        }
      }
    }

    return {
      prizeAmounts: prizeDetails.length > 0 ? prizeDetails : null,
      prizeDetailHtml,
    };
  } catch (error) {
    console.error(`[SSQ] 获取期号 ${issue} 的奖项详情失败:`, error);
    return { prizeAmounts: null, prizeDetailHtml: null };
  }
};

// 纯原生高性能异步并发控制限流池
async function limitConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = Promise.resolve()
      .then(() => task())
      .then((res) => {
        results[i] = res;
      });
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

const fetchYearData = async (
  year: number,
  needPrizeDetails?: Set<string>,
  excludePrizeDetails?: Set<string>,
  concurrentLimit: number = 3,
  delayMs: number = 200,
  limitDetailsCount?: number,
) => {
  const res = await fetch("https://www.17500.cn/api/kaijiang/getlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `lotid=ssq&limit=&year=${year}`,
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows = $("table tr").toArray();
  
  // 1. 单请求极速提取该年份的所有基础开奖结果
  const baseResults = [];
  for (let i = 1; i < rows.length; i++) {
    const tds = $(rows[i]).find("td");
    if (tds.length < 7) continue;
    const issueNumber = $(tds[0]).text().trim();
    const openDate = $(tds[1]).text().trim();
    const openNumbersRaw = $(tds[2]).text().trim();
    // 跳过未开奖的记录（开奖号码为 "-"）
    if (openNumbersRaw === "-" || !openNumbersRaw) continue;
    const numbers = openNumbersRaw.split(/\s+/);
    const tmpRed = numbers[0];
    const red = tmpRed.match(/.{2}/g) || [];
    const blue = numbers[1];
    const openNumbers = { red, blue };
    const ballOrder = $(tds[3]).text().trim();
    const totalBet = $(tds[4]).text().trim();
    const jackpot = $(tds[5]).text().trim();
    const detail = $(tds[6]).text().trim();

    baseResults.push({
      issueNumber,
      openDate,
      openNumbers,
      ballOrder,
      totalBet,
      jackpot,
      detail,
      prizeAmounts: null as any,
      prizeDetailHtml: null as any,
    });
  }

  // 2. 精准过滤出哪些期数真正需要补齐/获取详情
  let tasksToFetch = baseResults.filter((item) => {
    const isExcluded = excludePrizeDetails && excludePrizeDetails.has(item.issueNumber);
    const isNeeded = !needPrizeDetails || needPrizeDetails.has(item.issueNumber);
    return !isExcluded && isNeeded;
  });

  // 如果有限制，进行截断，主要用于全新冷启动年份的详情拉取控制
  if (limitDetailsCount !== undefined && tasksToFetch.length > limitDetailsCount) {
    tasksToFetch = tasksToFetch.slice(0, limitDetailsCount);
  }

  // 3. 构建并发微任务池，并发度限制由入参控制，兼顾速度与 IP 安全
  if (tasksToFetch.length > 0) {
    const fetchTasks = tasksToFetch.map((item) => {
      return async () => {
        const prizeData = await fetchPrizeDetails("ssq", item.issueNumber);
        item.prizeAmounts = prizeData.prizeAmounts;
        item.prizeDetailHtml = prizeData.prizeDetailHtml;
        // 保持单流的平滑延迟保护
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      };
    });

    await limitConcurrent(fetchTasks, concurrentLimit);
  }

  return baseResults;
};

export const ssqRouter = router({
  getList: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { page, pageSize } = input;
        const skip = (page - 1) * pageSize;
        const prisma = prismaService.getPrismaClient();
        const [total, results] = await Promise.all([
          prisma.sSQResult.count(),
          prisma.sSQResult.findMany({
            skip,
            take: pageSize,
            orderBy: { issueNumber: "desc" },
          }),
        ]);
        const tmpResults = results.map((item: any) => ({
          ...item,
          openNumbers:
            typeof item.openNumbers === "string"
              ? JSON.parse(item.openNumbers)
              : item.openNumbers,
          prizeAmounts:
            typeof item.prizeAmounts === "string"
              ? JSON.parse(item.prizeAmounts)
              : item.prizeAmounts,
        }));
        return {
          success: true,
          data: {
            total,
            page,
            pageSize,
            list: tmpResults,
          },
        };
      } catch (error) {
        console.error("Error in ssq.getList:", error);
        throw error;
      }
    }),
  fetchAndSave: publicProcedure
    .input(z.object({ year: z.string() }))
    .mutation(async ({ input }) => {
      const { year } = input;
      const prisma = prismaService.getPrismaClient();
      const yearNum = parseInt(year);

      // 查询数据库中该年份已存在的所有记录，联合获取 ballOrder 以避免二次查询
      const yearStartDate = new Date(`${yearNum}-01-01`);
      const yearEndDate = new Date(`${yearNum}-12-31 23:59:59`);
      const existingRecords = await prisma.sSQResult.findMany({
        where: {
          openDate: {
            gte: yearStartDate,
            lte: yearEndDate,
          },
        },
        select: { issueNumber: true, prizeDetailHtml: true, ballOrder: true },
      });

      // 提取已有详情的期号集合，用作排除
      const alreadyHasDetailsSet = new Set<string>(
        existingRecords
          .filter((r: any) => r.prizeDetailHtml)
          .map((r: any) => r.issueNumber),
      );

      const results: any[] = [];
      // 获取该年份的所有数据，极致性能优化：传入已存在的详情期号集以将其排除，只抓取全新或缺失详情的期号
      const data = await fetchYearData(
        yearNum,
        undefined,
        alreadyHasDetailsSet,
      );
      results.push(...data);

      const existingMap = new Map(
        existingRecords.map((r: any) => [r.issueNumber, r.ballOrder]),
      );
      // 过滤出需要处理的记录：不存在 或 ballOrder 为 "-"
      const recordsToProcess = results.filter(
        (item: any) =>
          !existingMap.has(item.issueNumber) ||
          existingMap.get(item.issueNumber) === "-",
      );
      if (recordsToProcess.length === 0) {
        // 即使没有新记录，也返回最新的开奖结果
        const latestResult = await prisma.sSQResult.findFirst({
          orderBy: { issueNumber: "desc" },
        });
        return {
          success: true,
          count: 0,
          latestResult: latestResult || undefined,
        };
      }
      // 批量 upsert 需要处理的记录
      const upserted = await prisma.$transaction(
        recordsToProcess.map((item) =>
          prisma.sSQResult.upsert({
            where: { issueNumber: item.issueNumber },
            update: {
              openDate: new Date(item.openDate),
              openNumbers: item.openNumbers,
              ballOrder: item.ballOrder,
              totalBet: item.totalBet,
              jackpot: item.jackpot,
              detail: item.detail,
              prizeAmounts: item.prizeAmounts,
              prizeDetailHtml: item.prizeDetailHtml,
            },
            create: {
              issueNumber: item.issueNumber,
              openDate: new Date(item.openDate),
              openNumbers: item.openNumbers,
              ballOrder: item.ballOrder,
              totalBet: item.totalBet,
              jackpot: item.jackpot,
              detail: item.detail,
              prizeAmounts: item.prizeAmounts,
              prizeDetailHtml: item.prizeDetailHtml,
            },
          }),
        ),
      );

      // 获取最新的一条开奖结果（按期号降序）
      const latestResult = await prisma.sSQResult.findFirst({
        orderBy: { issueNumber: "desc" },
      });

      return {
        success: true,
        count: upserted.length,
        latestResult: latestResult || undefined,
      };
    }),
  search: publicProcedure
    .input(
      z.object({
        numbers: z.array(z.string()).min(1).max(7),
        exactMatch: z.boolean().default(false),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      const { numbers, exactMatch, page, pageSize } = input;
      const prisma = prismaService.getPrismaClient();

      // 获取所有数据
      const allResults = await prisma.sSQResult.findMany({
        orderBy: { issueNumber: "desc" },
      });

      // 过滤匹配的数据
      // 双色球：前6个是红球，第7个是蓝球
      const matchedResults = allResults.filter((item: any) => {
        const openNumbers =
          typeof item.openNumbers === "string"
            ? JSON.parse(item.openNumbers)
            : item.openNumbers;

        const redNumbers = (openNumbers.red || []).map((n: string) =>
          n.toString().padStart(2, "0"),
        );
        const blueNumber = openNumbers.blue
          ? openNumbers.blue.toString().padStart(2, "0")
          : "";

        // 统一输入号码格式，并区分红球 and 蓝球
        // 前6个是红球，第7个是蓝球
        const inputRedNumbers = numbers
          .slice(0, 6)
          .map((n) => n.toString().padStart(2, "0"));
        const inputBlueNumber =
          numbers.length >= 7 ? numbers[6].toString().padStart(2, "0") : null;

        if (exactMatch) {
          // 全匹配：输入的号码必须全部在对应颜色的开奖号码中
          const redMatched = inputRedNumbers.every((num) =>
            redNumbers.includes(num),
          );
          const blueMatched =
            inputBlueNumber === null || blueNumber === inputBlueNumber;
          return redMatched && blueMatched;
        } else {
          // 模糊匹配：只要输入的号码中任意一个在对应颜色的开奖号码中出现就显示
          const redMatch = inputRedNumbers.some((num) =>
            redNumbers.includes(num),
          );
          const blueMatch =
            inputBlueNumber === null || blueNumber === inputBlueNumber;
          return redMatch || blueMatch;
        }
      });

      // 分页处理
      const total = matchedResults.length;
      const skip = (page - 1) * pageSize;
      const paginatedResults = matchedResults.slice(skip, skip + pageSize);

      const formattedResults = paginatedResults.map((item: any) => ({
        ...item,
        openNumbers:
          typeof item.openNumbers === "string"
            ? JSON.parse(item.openNumbers)
            : item.openNumbers,
      }));

      return {
        success: true,
        data: {
          total,
          page,
          pageSize,
          list: formattedResults,
        },
      };
    }),
  refreshAll: publicProcedure
    .input(
      z.object({
        fetchDetails: z.boolean().default(false),
        limit: z.number().default(30),
        concurrentLimit: z.number().default(3),
        delayMs: z.number().default(200),
        yearConcurrentLimit: z.number().default(2),
      }).optional(),
    )
    .mutation(async ({ input }) => {
      const {
        fetchDetails = false,
        limit = 30,
        concurrentLimit = 3,
        delayMs = 200,
        yearConcurrentLimit = 2,
      } = input ?? {};
      // 一键刷新所有数据：只处理 prizeDetailHtml 为空或不存在的数据
      console.log(
        `[SSQ] [REFRESH_ALL] ========== 开始一键刷新所有数据 (并发提速版) ==========`,
      );
      const totalStartTime = Date.now();
      const prisma = prismaService.getPrismaClient();
      const startYear = 2003; // 双色球的最早发行年份
      const thisYear = new Date().getFullYear();
      let totalCount = 0;

      // 1. 构建年份并发微任务
      const yearTasks = [];

      for (let currentYear = thisYear; currentYear >= startYear; currentYear--) {
        const year = currentYear;
        yearTasks.push(async () => {
          console.log(`[SSQ] [REFRESH_ALL] 开始处理 ${year} 年数据...`);
          const yearStartTime = Date.now();

          try {
            // 先查询数据库中该年份的所有记录，用于判断是否为冷启动以及做完整导入
            const yearStartDate = new Date(`${year}-01-01`);
            const yearEndDate = new Date(`${year}-12-31 23:59:59`);
            const existingRecords = await prisma.sSQResult.findMany({
              where: {
                openDate: {
                  gte: yearStartDate,
                  lte: yearEndDate,
                },
              },
              select: { issueNumber: true, prizeDetailHtml: true },
            });
            const existingMap = new Map(
              existingRecords.map((r: any) => [r.issueNumber, r.prizeDetailHtml]),
            );

            // 提取需要补全详情的期号
            const needPrizeDetailsSet = new Set<string>(
              existingRecords
                .filter((r: any) => !r.prizeDetailHtml)
                .map((r: any) => r.issueNumber),
            );

            // 性能优化与防封 IP 策略
            const isCurrentYear = year === thisYear;
            if (!isCurrentYear && existingRecords.length >= 140 && needPrizeDetailsSet.size === 0) {
              console.log(`[SSQ] [REFRESH_ALL] ${year} 年数据已完备，秒级跳过处理`);
              return;
            }

            // 获取该年份的所有数据
            let yearData: any[] = [];
            
            if (existingRecords.length === 0) {
              if (fetchDetails) {
                console.log(
                  `[SSQ] [REFRESH_ALL] 冷启动检测到新年份 ${year}，同时开启详情拉取限制 (最多前 ${limit} 期)...`
                );
                yearData = await fetchYearData(
                  year,
                  undefined,
                  undefined,
                  concurrentLimit,
                  delayMs,
                  limit,
                );
              } else {
                console.log(
                  `[SSQ] [REFRESH_ALL] 冷启动检测到新年份 ${year}，仅拉取基础列表以防封禁 IP...`
                );
                yearData = await fetchYearData(
                  year,
                  new Set<string>(), // 传入空的 Set 阻止高频子请求，仅拉取期号基本列表
                  undefined,
                  concurrentLimit,
                  delayMs,
                );
              }
            } else {
              // 详情补全平滑限流
              let finalDetailsSet = needPrizeDetailsSet;
              if (needPrizeDetailsSet.size > limit) {
                finalDetailsSet = new Set(Array.from(needPrizeDetailsSet).slice(0, limit));
                console.log(
                  `[SSQ] [REFRESH_ALL] ${year} 年缺失详情较多 (${needPrizeDetailsSet.size} 期)，本轮只补齐前 ${limit} 期，其余将平滑渐进补齐`,
                );
              }

              yearData = await fetchYearData(
                year,
                finalDetailsSet,
                undefined,
                concurrentLimit,
                delayMs,
              );
            }

            if (yearData.length === 0) {
              console.log(`[SSQ] [REFRESH_ALL] ${year} 年获取到 0 条数据，跳过`);
              return;
            }

            // 筛选出需要处理的记录
            const recordsToProcess = yearData.filter((item: any) => {
              const hasRecord = existingMap.has(item.issueNumber);
              const detailHtml = existingMap.get(item.issueNumber);
              return !hasRecord || !detailHtml;
            });

            console.log(
              `[SSQ] [REFRESH_ALL] ${year} 年获取 ${yearData.length} 条数据，其中 ${recordsToProcess.length} 条需要更新 prizeDetailHtml`,
            );

            if (recordsToProcess.length > 0) {
              // 分批处理，每批100条
              const batchSize = 100;
              let yearCount = 0;
              for (let i = 0; i < recordsToProcess.length; i += batchSize) {
                const batch = recordsToProcess.slice(i, i + batchSize);
                const upserted = await prisma.$transaction(
                  batch.map((item) =>
                    prisma.sSQResult.upsert({
                      where: { issueNumber: item.issueNumber },
                      update: {
                        openDate: new Date(item.openDate),
                        openNumbers: item.openNumbers,
                        ballOrder: item.ballOrder,
                        totalBet: item.totalBet,
                        jackpot: item.jackpot,
                        detail: item.detail,
                        prizeAmounts: item.prizeAmounts || undefined,
                        prizeDetailHtml: item.prizeDetailHtml || undefined,
                      },
                      create: {
                        issueNumber: item.issueNumber,
                        openDate: new Date(item.openDate),
                        openNumbers: item.openNumbers,
                        ballOrder: item.ballOrder,
                        totalBet: item.totalBet,
                        jackpot: item.jackpot,
                        detail: item.detail,
                        prizeAmounts: item.prizeAmounts || undefined,
                        prizeDetailHtml: item.prizeDetailHtml || undefined,
                      },
                    }),
                  ),
                );
                yearCount += upserted.length;
              }
              totalCount += yearCount;
              const yearDuration = Date.now() - yearStartTime;
              console.log(
                `[SSQ] [REFRESH_ALL] ${year} 年处理完成，更新 ${yearCount} 条数据，耗时 ${yearDuration}ms`,
              );
            } else {
              const yearDuration = Date.now() - yearStartTime;
              console.log(
                `[SSQ] [REFRESH_ALL] ${year} 年无需更新，耗时 ${yearDuration}ms`,
              );
            }
          } catch (yearError) {
            console.error(`[SSQ] [REFRESH_ALL] 处理 ${year} 年数据时发生严重错误:`, yearError);
          }
        });
      }

      // 2. 年份级并发限制池调度
      await limitConcurrent(yearTasks, yearConcurrentLimit);

      const totalDuration = Date.now() - totalStartTime;
      console.log(
        `[SSQ] [REFRESH_ALL] ========== 一键刷新完成 ========== 共处理 ${totalCount} 条数据，总耗时 ${totalDuration}ms`,
      );
      return { success: true, count: totalCount };
    }),
});
