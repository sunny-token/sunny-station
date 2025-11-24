import { publicProcedure, router } from "../trpc";
import prismaService from "../../lib/prismaService";
import { z } from "zod";
import { checkWin, type TicketNumbers } from "../../lib/lotteryRules";
import * as XLSX from "xlsx";

/**
 * 预设号码管理路由
 */
export const ticketRouter = router({
  // 获取预设号码列表
  getList: publicProcedure
    .input(
      z.object({
        lotteryType: z.enum(["ssq", "dlt"]).optional(),
        isActive: z.boolean().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      const { lotteryType, isActive, page, pageSize } = input;
      const skip = (page - 1) * pageSize;
      const prisma = prismaService.getPrismaClient();

      const where: any = {};
      if (lotteryType) where.lotteryType = lotteryType;
      if (isActive !== undefined) where.isActive = isActive;

      const [total, results] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const formattedResults = results.map((item: any) => ({
        ...item,
        numbers:
          typeof item.numbers === "string"
            ? JSON.parse(item.numbers)
            : item.numbers,
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

  // 添加预设号码
  create: publicProcedure
    .input(
      z.object({
        lotteryType: z.enum(["ssq", "dlt"]),
        name: z.string().min(1),
        numbers: z.object({
          red: z.array(z.string()),
          blue: z.array(z.string()),
        }),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const prisma = prismaService.getPrismaClient();

      // 验证号码数量
      if (input.lotteryType === "ssq") {
        if (input.numbers.red.length !== 6) {
          throw new Error("双色球需要6个红球");
        }
        if (input.numbers.blue.length !== 1) {
          throw new Error("双色球需要1个蓝球");
        }
      } else {
        if (input.numbers.red.length !== 5) {
          throw new Error("大乐透需要5个红球");
        }
        if (input.numbers.blue.length !== 2) {
          throw new Error("大乐透需要2个蓝球");
        }
      }

      const ticket = await prisma.ticket.create({
        data: {
          lotteryType: input.lotteryType,
          name: input.name,
          numbers: input.numbers,
          isActive: input.isActive,
        },
      });

      return {
        success: true,
        data: {
          ...ticket,
          numbers:
            typeof ticket.numbers === "string"
              ? JSON.parse(ticket.numbers)
              : ticket.numbers,
        },
      };
    }),

  // 更新预设号码
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        numbers: z
          .object({
            red: z.array(z.string()),
            blue: z.array(z.string()),
          })
          .optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const prisma = prismaService.getPrismaClient();

      const existing = await prisma.ticket.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("预设号码不存在");
      }

      // 如果更新号码，验证数量
      if (updateData.numbers) {
        if (existing.lotteryType === "ssq") {
          if (updateData.numbers.red.length !== 6) {
            throw new Error("双色球需要6个红球");
          }
          if (updateData.numbers.blue.length !== 1) {
            throw new Error("双色球需要1个蓝球");
          }
        } else {
          if (updateData.numbers.red.length !== 5) {
            throw new Error("大乐透需要5个红球");
          }
          if (updateData.numbers.blue.length !== 2) {
            throw new Error("大乐透需要2个蓝球");
          }
        }
      }

      const ticket = await prisma.ticket.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        data: {
          ...ticket,
          numbers:
            typeof ticket.numbers === "string"
              ? JSON.parse(ticket.numbers)
              : ticket.numbers,
        },
      };
    }),

  // 删除预设号码
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const prisma = prismaService.getPrismaClient();
      await prisma.ticket.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // 检查中奖（用于测试）
  checkWin: publicProcedure
    .input(
      z.object({
        ticketId: z.number(),
        issueNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const prisma = prismaService.getPrismaClient();

      const ticket = await prisma.ticket.findUnique({
        where: { id: input.ticketId },
      });
      if (!ticket) {
        throw new Error("预设号码不存在");
      }

      const ticketNumbers =
        typeof ticket.numbers === "string"
          ? JSON.parse(ticket.numbers)
          : ticket.numbers;

      let openNumbers: any;
      if (ticket.lotteryType === "ssq") {
        const result = await prisma.sSQResult.findUnique({
          where: { issueNumber: input.issueNumber },
        });
        if (!result) {
          throw new Error("开奖结果不存在");
        }
        openNumbers =
          typeof result.openNumbers === "string"
            ? JSON.parse(result.openNumbers)
            : result.openNumbers;
      } else {
        const result = await prisma.dLTResult.findUnique({
          where: { issueNumber: input.issueNumber },
        });
        if (!result) {
          throw new Error("开奖结果不存在");
        }
        openNumbers =
          typeof result.openNumbers === "string"
            ? JSON.parse(result.openNumbers)
            : result.openNumbers;
      }

      const matchResult = checkWin(
        ticket.lotteryType as "ssq" | "dlt",
        ticketNumbers as TicketNumbers,
        openNumbers as TicketNumbers,
      );

      return {
        success: true,
        data: matchResult,
      };
    }),

  // 批量导入预设号码（从 Excel）- 自动识别所有类型
  batchImport: publicProcedure
    .input(
      z.object({
        fileData: z.string(), // base64 编码的 Excel 文件数据
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const prisma = prismaService.getPrismaClient();
      const { fileData, isActive } = input;

      try {
        // 解码 base64 数据
        const buffer = Buffer.from(fileData, "base64");

        // 解析 Excel 文件
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const allTickets: Array<{
          lotteryType: "ssq" | "dlt";
          name: string;
          numbers: { red: string[]; blue: string[] };
          isActive: boolean;
        }> = [];

        const allErrors: string[] = [];
        const summary: {
          [key: string]: { total: number; created: number; skipped: number };
        } = {};

        // 遍历所有工作表
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as any[][];

          if (rows.length < 2) {
            allErrors.push(
              `工作表 "${sheetName}"：至少需要包含表头和一行数据，已跳过`,
            );
            continue;
          }

          // 根据工作表名称判断类型，或根据列数推断
          let lotteryType: "ssq" | "dlt" | null = null;
          const sheetNameLower = sheetName.toLowerCase();
          if (
            sheetNameLower.includes("双色球") ||
            sheetNameLower.includes("ssq")
          ) {
            lotteryType = "ssq";
          } else if (
            sheetNameLower.includes("大乐透") ||
            sheetNameLower.includes("dlt")
          ) {
            lotteryType = "dlt";
          }

          // 解析表头
          const header = rows[0].map((h: any) =>
            String(h || "")
              .toLowerCase()
              .trim(),
          );
          const nameColIndex = header.findIndex(
            (h: string) =>
              h.includes("名称") || h.includes("name") || h.includes("备注"),
          );

          if (nameColIndex === -1) {
            allErrors.push(`工作表 "${sheetName}"：未找到'名称'列，已跳过`);
            continue;
          }

          // 查找红球和蓝球列
          const redColIndices: number[] = [];
          const blueColIndices: number[] = [];

          header.forEach((h: string, index: number) => {
            if (h.includes("红") || h.includes("red") || /^红\d+$/.test(h)) {
              redColIndices.push(index);
            } else if (
              h.includes("蓝") ||
              h.includes("blue") ||
              /^蓝\d+$/.test(h)
            ) {
              blueColIndices.push(index);
            }
          });

          // 如果没找到列名，根据列数推断类型
          if (redColIndices.length === 0 && blueColIndices.length === 0) {
            // 尝试按位置推断：名称列之后是号码
            const numCols = header.length - nameColIndex - 1;
            if (numCols >= 7) {
              // 双色球：6红+1蓝 = 7列，大乐透：5红+2蓝 = 7列
              // 如果工作表名称已指定类型，使用它；否则先尝试双色球
              if (!lotteryType) {
                // 默认尝试双色球（6红+1蓝）
                lotteryType = "ssq";
                for (let i = nameColIndex + 1; i < nameColIndex + 7; i++) {
                  redColIndices.push(i);
                }
                blueColIndices.push(nameColIndex + 7);
              } else if (lotteryType === "dlt") {
                // 大乐透：5红+2蓝
                for (let i = nameColIndex + 1; i < nameColIndex + 6; i++) {
                  redColIndices.push(i);
                }
                blueColIndices.push(nameColIndex + 6);
                blueColIndices.push(nameColIndex + 7);
              } else {
                // 双色球：6红+1蓝
                for (let i = nameColIndex + 1; i < nameColIndex + 7; i++) {
                  redColIndices.push(i);
                }
                blueColIndices.push(nameColIndex + 7);
              }
            } else {
              allErrors.push(
                `工作表 "${sheetName}"：无法识别彩票类型（号码列数：${numCols}，需要至少7列），已跳过`,
              );
              continue;
            }
          } else {
            // 根据列数推断类型
            if (!lotteryType) {
              if (redColIndices.length === 6 && blueColIndices.length === 1) {
                lotteryType = "ssq";
              } else if (
                redColIndices.length === 5 &&
                blueColIndices.length === 2
              ) {
                lotteryType = "dlt";
              } else {
                allErrors.push(
                  `工作表 "${sheetName}"：无法根据列数识别彩票类型（红球${redColIndices.length}个，蓝球${blueColIndices.length}个），已跳过`,
                );
                continue;
              }
            }
          }

          const expectedRedCount = lotteryType === "ssq" ? 6 : 5;
          const expectedBlueCount = lotteryType === "ssq" ? 1 : 2;

          if (
            redColIndices.length !== expectedRedCount ||
            blueColIndices.length !== expectedBlueCount
          ) {
            allErrors.push(
              `工作表 "${sheetName}"：${lotteryType === "ssq" ? "双色球" : "大乐透"}需要 ${expectedRedCount} 个红球和 ${expectedBlueCount} 个蓝球，但找到 ${redColIndices.length} 个红球和 ${blueColIndices.length} 个蓝球，已跳过`,
            );
            continue;
          }

          // 解析数据行
          const sheetTickets: typeof allTickets = [];
          const sheetErrors: string[] = [];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];

            if (
              !row ||
              row.every((cell: any) => !cell || String(cell).trim() === "")
            ) {
              continue;
            }

            try {
              const name = String(row[nameColIndex] || "").trim();
              if (!name) {
                sheetErrors.push(
                  `工作表 "${sheetName}" 第 ${i + 1} 行：名称为空，已跳过`,
                );
                continue;
              }

              // 解析红球
              const red: string[] = [];
              for (const colIndex of redColIndices) {
                const value = row[colIndex];
                if (value === undefined || value === null) {
                  sheetErrors.push(
                    `工作表 "${sheetName}" 第 ${i + 1} 行：红球数据不完整，已跳过`,
                  );
                  break;
                }
                const num = String(value).trim().padStart(2, "0");
                if (!/^\d{2}$/.test(num)) {
                  sheetErrors.push(
                    `工作表 "${sheetName}" 第 ${i + 1} 行：红球号码格式错误 "${value}"，已跳过`,
                  );
                  break;
                }
                red.push(num);
              }

              if (red.length !== expectedRedCount) continue;

              // 解析蓝球
              const blue: string[] = [];
              for (const colIndex of blueColIndices) {
                const value = row[colIndex];
                if (value === undefined || value === null) {
                  sheetErrors.push(
                    `工作表 "${sheetName}" 第 ${i + 1} 行：蓝球数据不完整，已跳过`,
                  );
                  break;
                }
                const num = String(value).trim().padStart(2, "0");
                if (!/^\d{2}$/.test(num)) {
                  sheetErrors.push(
                    `工作表 "${sheetName}" 第 ${i + 1} 行：蓝球号码格式错误 "${value}"，已跳过`,
                  );
                  break;
                }
                blue.push(num);
              }

              if (blue.length !== expectedBlueCount) continue;

              // 验证号码范围
              const redMax = lotteryType === "ssq" ? 33 : 35;
              const blueMax = lotteryType === "ssq" ? 16 : 12;

              const invalidRed = red.find(
                (n) => parseInt(n) < 1 || parseInt(n) > redMax,
              );
              if (invalidRed) {
                sheetErrors.push(
                  `工作表 "${sheetName}" 第 ${i + 1} 行：红球号码 ${invalidRed} 超出范围（1-${redMax}），已跳过`,
                );
                continue;
              }

              const invalidBlue = blue.find(
                (n) => parseInt(n) < 1 || parseInt(n) > blueMax,
              );
              if (invalidBlue) {
                sheetErrors.push(
                  `工作表 "${sheetName}" 第 ${i + 1} 行：蓝球号码 ${invalidBlue} 超出范围（1-${blueMax}），已跳过`,
                );
                continue;
              }

              // 检查重复号码
              const redSet = new Set(red);
              if (redSet.size !== red.length) {
                sheetErrors.push(
                  `工作表 "${sheetName}" 第 ${i + 1} 行：红球号码有重复，已跳过`,
                );
                continue;
              }

              const blueSet = new Set(blue);
              if (blueSet.size !== blue.length) {
                sheetErrors.push(
                  `工作表 "${sheetName}" 第 ${i + 1} 行：蓝球号码有重复，已跳过`,
                );
                continue;
              }

              sheetTickets.push({
                lotteryType,
                name,
                numbers: { red, blue },
                isActive,
              });
            } catch (error) {
              sheetErrors.push(
                `工作表 "${sheetName}" 第 ${i + 1} 行：解析失败 - ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          allTickets.push(...sheetTickets);
          allErrors.push(...sheetErrors);

          if (sheetTickets.length > 0) {
            summary[sheetName] = {
              total: sheetTickets.length,
              created: 0,
              skipped: 0,
            };
          }
        }

        if (allTickets.length === 0) {
          throw new Error(
            "没有有效的预设号码数据。请检查 Excel 格式。\n" +
              allErrors.join("\n"),
          );
        }

        // 生成唯一键的函数：类型 + 排序后的号码组合
        const getTicketKey = (ticket: {
          lotteryType: "ssq" | "dlt";
          numbers: { red: string[]; blue: string[] };
        }) => {
          const redSorted = [...ticket.numbers.red].sort().join(",");
          const blueSorted = [...ticket.numbers.blue].sort().join(",");
          return `${ticket.lotteryType}:${redSorted}|${blueSorted}`;
        };

        // 1. 文件内去重：相同类型和号码组合只保留第一个
        const fileDeduplicatedMap = new Map<string, (typeof allTickets)[0]>();
        const fileDuplicates: string[] = [];

        for (const ticket of allTickets) {
          const key = getTicketKey(ticket);
          if (fileDeduplicatedMap.has(key)) {
            fileDuplicates.push(
              `文件内重复：${ticket.lotteryType === "ssq" ? "双色球" : "大乐透"} - ${ticket.name} (号码: ${ticket.numbers.red.join(",")} + ${ticket.numbers.blue.join(",")})`,
            );
          } else {
            fileDeduplicatedMap.set(key, ticket);
          }
        }

        const fileDeduplicatedTickets = Array.from(
          fileDeduplicatedMap.values(),
        );

        if (fileDuplicates.length > 0) {
          allErrors.push(
            `文件内去重：发现 ${fileDuplicates.length} 条重复数据，已自动去重`,
            ...fileDuplicates.slice(0, 10),
          );
        }

        // 2. 查询数据库中已有的 tickets，进行去重
        const existingTickets = await prisma.ticket.findMany({
          select: {
            lotteryType: true,
            numbers: true,
          },
        });

        const existingKeys = new Set(
          existingTickets.map((t) => {
            const numbers =
              typeof t.numbers === "string" ? JSON.parse(t.numbers) : t.numbers;
            return getTicketKey({
              lotteryType: t.lotteryType as "ssq" | "dlt",
              numbers: numbers as { red: string[]; blue: string[] },
            });
          }),
        );

        // 3. 过滤出数据库中不存在的 tickets
        const newTickets: typeof allTickets = [];
        const dbDuplicates: string[] = [];

        for (const ticket of fileDeduplicatedTickets) {
          const key = getTicketKey(ticket);
          if (existingKeys.has(key)) {
            dbDuplicates.push(
              `数据库中已存在：${ticket.lotteryType === "ssq" ? "双色球" : "大乐透"} - ${ticket.name} (号码: ${ticket.numbers.red.join(",")} + ${ticket.numbers.blue.join(",")})`,
            );
          } else {
            newTickets.push(ticket);
          }
        }

        if (dbDuplicates.length > 0) {
          allErrors.push(
            `数据库去重：发现 ${dbDuplicates.length} 条已存在数据，已跳过`,
            ...dbDuplicates.slice(0, 10),
          );
        }

        // 4. 批量插入新数据
        let created = 0;
        if (newTickets.length > 0) {
          const result = await prisma.ticket.createMany({
            data: newTickets,
            skipDuplicates: true,
          });
          created = result.count;
        }

        // 更新汇总信息
        const typeSummary: { ssq: number; dlt: number } = { ssq: 0, dlt: 0 };
        fileDeduplicatedTickets.forEach((t) => {
          typeSummary[t.lotteryType]++;
        });

        const newTypeSummary: { ssq: number; dlt: number } = { ssq: 0, dlt: 0 };
        newTickets.forEach((t) => {
          newTypeSummary[t.lotteryType]++;
        });

        return {
          success: true,
          data: {
            total: fileDeduplicatedTickets.length, // 文件内去重后的总数
            created: created, // 实际插入的数量
            skipped: fileDeduplicatedTickets.length - created, // 跳过的数量（包括文件内重复和数据库重复）
            fileDuplicates: fileDuplicates.length, // 文件内重复数量
            dbDuplicates: dbDuplicates.length, // 数据库重复数量
            typeSummary: {
              ssq: typeSummary.ssq,
              dlt: typeSummary.dlt,
            },
            newTypeSummary: {
              ssq: newTypeSummary.ssq,
              dlt: newTypeSummary.dlt,
            },
            sheetSummary: summary,
            errors: allErrors.length > 0 ? allErrors : undefined,
          },
        };
      } catch (error) {
        throw new Error(
          `导入失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
});
