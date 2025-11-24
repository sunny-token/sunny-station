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
    console.error(`[DLT] 获取期号 ${issue} 的奖项详情失败:`, error);
    return { prizeAmounts: null, prizeDetailHtml: null };
  }
};

const fetchYearData = async (year: number, needPrizeDetails?: Set<string>) => {
  const res = await fetch("https://www.17500.cn/api/kaijiang/getlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `lotid=dlt&limit=&year=${year}`,
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows = $("table tr").toArray();
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const tds = $(rows[i]).find("td");
    if (tds.length < 7) continue;
    const issueNumber = $(tds[0]).text().trim();
    const openDate = $(tds[1]).text().trim();
    const openNumbersRaw = $(tds[2]).text().trim();
    // 跳过未开奖的记录（开奖号码为 "-"）
    if (openNumbersRaw === "-" || !openNumbersRaw) continue;
    const numbers = openNumbersRaw.split(/\s+/);
    const tmpRed = numbers[0] ?? "";
    const red = tmpRed.match(/.{2}/g) || [];
    const tmpBlue = numbers[1] ?? "";
    const blue = tmpBlue.match(/.{2}/g) || [];
    const openNumbers = { red, blue };
    const ballOrder = $(tds[3]).text().trim();
    const totalBet = $(tds[4]).text().trim();
    const jackpot = $(tds[5]).text().trim();
    const detail = $(tds[6]).text().trim();

    // 获取奖项奖金信息
    // 如果指定了 needPrizeDetails，只对需要的记录获取；否则获取所有记录
    let prizeAmounts = null;
    let prizeDetailHtml = null;
    if (!needPrizeDetails || needPrizeDetails.has(issueNumber)) {
      const prizeData = await fetchPrizeDetails("dlt", issueNumber);
      prizeAmounts = prizeData.prizeAmounts;
      prizeDetailHtml = prizeData.prizeDetailHtml;
    }

    results.push({
      issueNumber,
      openDate,
      openNumbers,
      ballOrder,
      totalBet,
      jackpot,
      detail,
      prizeAmounts,
      prizeDetailHtml,
    });
  }
  return results;
};

export const dltRouter = router({
  getList: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize } = input;
      const skip = (page - 1) * pageSize;
      const prisma = prismaService.getPrismaClient();
      const [total, results] = await Promise.all([
        prisma.dLTResult.count(),
        prisma.dLTResult.findMany({
          skip,
          take: pageSize,
          orderBy: { issueNumber: "desc" },
        }),
      ]);
      const newResults = results.map((item: any) => ({
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
          list: newResults,
        },
      };
    }),
  fetchAndSave: publicProcedure
    .input(z.object({ year: z.string().default("all") }))
    .mutation(async ({ input }) => {
      const { year } = input;
      const prisma = prismaService.getPrismaClient();
      const yearNum = parseInt(year);

      // 先查询数据库中该年份 prizeDetailHtml 为空或 null 的记录
      const yearStartDate = new Date(`${yearNum}-01-01`);
      const yearEndDate = new Date(`${yearNum}-12-31 23:59:59`);
      const existingRecordsWithoutPrize = await prisma.dLTResult.findMany({
        where: {
          openDate: {
            gte: yearStartDate,
            lte: yearEndDate,
          },
          OR: [{ prizeDetailHtml: null }, { prizeDetailHtml: "" }],
        },
        select: { issueNumber: true },
      });
      const needPrizeDetailsSet = new Set(
        existingRecordsWithoutPrize.map((r) => r.issueNumber),
      );

      const results: any[] = [];
      // 获取该年份的所有数据，只对需要更新的记录调用 fetchPrizeDetails
      const data = await fetchYearData(
        yearNum,
        needPrizeDetailsSet.size > 0 ? needPrizeDetailsSet : undefined,
      );
      results.push(...data);

      // 查询已存在的记录，只获取 issueNumber 和 ballOrder
      const existingRecords = await prisma.dLTResult.findMany({
        where: {
          issueNumber: { in: results.map((r) => r.issueNumber) },
        },
        select: { issueNumber: true, ballOrder: true },
      });
      const existingMap = new Map(
        existingRecords.map((r) => [r.issueNumber, r.ballOrder]),
      );
      // 过滤出需要处理的记录：不存在 或 ballOrder 为 "-"
      const recordsToProcess = results.filter(
        (item) =>
          !existingMap.has(item.issueNumber) ||
          existingMap.get(item.issueNumber) === "-",
      );
      if (recordsToProcess.length === 0) {
        return { success: true, count: 0 };
      }
      // 批量 upsert 需要处理的记录
      const upserted = await prisma.$transaction(
        recordsToProcess.map((item) =>
          prisma.dLTResult.upsert({
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
      return { success: true, count: upserted.length };
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
      const allResults = await prisma.dLTResult.findMany({
        orderBy: { issueNumber: "desc" },
      });

      // 过滤匹配的数据
      // 大乐透：前5个是红球，后2个是蓝球
      const matchedResults = allResults.filter((item: any) => {
        const openNumbers =
          typeof item.openNumbers === "string"
            ? JSON.parse(item.openNumbers)
            : item.openNumbers;

        const redNumbers = (openNumbers.red || []).map((n: string) =>
          n.toString().padStart(2, "0"),
        );
        const blueNumbers = (openNumbers.blue || []).map((n: string) =>
          n.toString().padStart(2, "0"),
        );

        // 统一输入号码格式，并区分红球和蓝球
        // 前5个是红球，后2个是蓝球
        const inputRedNumbers = numbers
          .slice(0, 5)
          .map((n) => n.toString().padStart(2, "0"));
        const inputBlueNumbers = numbers
          .slice(5, 7)
          .map((n) => n.toString().padStart(2, "0"));

        if (exactMatch) {
          // 全匹配：输入的号码必须全部在对应颜色的开奖号码中
          const redMatched = inputRedNumbers.every((num) =>
            redNumbers.includes(num),
          );
          const blueMatched =
            inputBlueNumbers.length === 0 ||
            inputBlueNumbers.every((num) => blueNumbers.includes(num));
          return redMatched && blueMatched;
        } else {
          // 模糊匹配：只要输入的号码中任意一个在对应颜色的开奖号码中出现就显示
          const redMatch = inputRedNumbers.some((num) =>
            redNumbers.includes(num),
          );
          const blueMatch =
            inputBlueNumbers.length === 0 ||
            inputBlueNumbers.some((num) => blueNumbers.includes(num));
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
  refreshAll: publicProcedure.mutation(async () => {
    // 一键刷新所有数据：只处理 prizeDetailHtml 为空或不存在的数据
    console.log(
      `[DLT] [REFRESH_ALL] ========== 开始一键刷新所有数据 ==========`,
    );
    const totalStartTime = Date.now();
    const prisma = prismaService.getPrismaClient();
    let currentYear = new Date().getFullYear();
    let hasData = true;
    let totalCount = 0;

    while (hasData && currentYear >= 2007) {
      console.log(`[DLT] [REFRESH_ALL] 开始处理 ${currentYear} 年数据...`);
      const yearStartTime = Date.now();

      // 先查询数据库中该年份 prizeDetailHtml 为空或 null 的记录
      const yearStartDate = new Date(`${currentYear}-01-01`);
      const yearEndDate = new Date(`${currentYear}-12-31 23:59:59`);
      const existingRecords = await prisma.dLTResult.findMany({
        where: {
          openDate: {
            gte: yearStartDate,
            lte: yearEndDate,
          },
          OR: [{ prizeDetailHtml: null }, { prizeDetailHtml: "" }],
        },
        select: { issueNumber: true },
      });
      const needPrizeDetailsSet = new Set(
        existingRecords.map((r) => r.issueNumber),
      );

      // 获取该年份的所有数据，只对需要更新的记录调用 fetchPrizeDetails
      const yearData = await fetchYearData(
        currentYear,
        needPrizeDetailsSet.size > 0 ? needPrizeDetailsSet : undefined,
      );
      const firstData = yearData[0];
      const firstDataYear = firstData?.openDate.split("-")[0];

      if (firstDataYear !== currentYear.toString()) {
        hasData = false;
        console.log(`[DLT] [REFRESH_ALL] ${currentYear} 年无数据，结束处理`);
      } else {
        // 筛选出需要处理的记录（prizeDetailHtml 为空或不存在）
        const recordsToProcess = yearData.filter((item) =>
          needPrizeDetailsSet.has(item.issueNumber),
        );

        console.log(
          `[DLT] [REFRESH_ALL] ${currentYear} 年获取 ${yearData.length} 条数据，其中 ${recordsToProcess.length} 条需要更新 prizeDetailHtml`,
        );

        if (recordsToProcess.length > 0) {
          // 分批处理，每批100条，避免事务过大
          const batchSize = 100;
          let yearCount = 0;
          for (let i = 0; i < recordsToProcess.length; i += batchSize) {
            const batch = recordsToProcess.slice(i, i + batchSize);
            const upserted = await prisma.$transaction(
              batch.map((item) =>
                prisma.dLTResult.upsert({
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
            `[DLT] [REFRESH_ALL] ${currentYear} 年处理完成，更新 ${yearCount} 条数据，耗时 ${yearDuration}ms`,
          );
        } else {
          const yearDuration = Date.now() - yearStartTime;
          console.log(
            `[DLT] [REFRESH_ALL] ${currentYear} 年无需更新，耗时 ${yearDuration}ms`,
          );
        }
      }
      currentYear--;
    }

    const totalDuration = Date.now() - totalStartTime;
    console.log(
      `[DLT] [REFRESH_ALL] ========== 一键刷新完成 ========== 共处理 ${totalCount} 条数据，总耗时 ${totalDuration}ms`,
    );
    return { success: true, count: totalCount };
  }),
});
