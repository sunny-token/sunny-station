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
    body: `lotid=ssq&limit=&year=${year}`,
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
    const numbers = openNumbersRaw.split(/\s+/);
    const tmpRed = numbers[0];
    const red = tmpRed.match(/.{2}/g) || [];
    const blue = numbers[1];
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

export const ssqRouter = router({
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
        while (hasData && currentYear >= 2000) {
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
      const created = await prisma.sSQResult.createMany({
        data: results.map((item) => ({
          issueNumber: item.issueNumber,
          openDate: new Date(item.openDate),
          openNumbers: item.openNumbers,
          ballOrder: item.ballOrder,
          totalBet: item.totalBet,
          jackpot: item.jackpot,
          detail: item.detail,
        })),
        skipDuplicates: true,
      });
      return { success: true, count: created.count };
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

        // 统一输入号码格式，并区分红球和蓝球
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
});
