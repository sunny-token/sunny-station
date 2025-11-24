import { publicProcedure, router } from "../trpc";
import * as cheerio from "cheerio";
import prismaService from "../../lib/prismaService";
import { z } from "zod";

const fetchYearData = async (year: number) => {
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
    results.push({
      issueNumber,
      openDate,
      openNumbers,
      ballOrder,
      totalBet,
      jackpot,
      detail,
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
      let currentYear = new Date().getFullYear();
      const results: any[] = [];
      if (year !== "all") {
        const data = await fetchYearData(parseInt(year));
        results.push(...data);
      } else {
        let hasData = true;
        while (hasData && currentYear >= 2007) {
          const yearData = await fetchYearData(currentYear);
          const firstData = yearData[0];
          const firstDataYear = firstData?.openDate.split("-")[0];
          if (firstDataYear !== currentYear.toString()) {
            hasData = false;
          } else {
            results.push(...yearData);
          }
          currentYear--;
        }
      }
      const prisma = prismaService.getPrismaClient();
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
            },
            create: {
              issueNumber: item.issueNumber,
              openDate: new Date(item.openDate),
              openNumbers: item.openNumbers,
              ballOrder: item.ballOrder,
              totalBet: item.totalBet,
              jackpot: item.jackpot,
              detail: item.detail,
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
});
