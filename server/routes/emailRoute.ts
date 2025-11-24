import { publicProcedure, router } from "../trpc";
import prismaService from "../../lib/prismaService";
import { z } from "zod";

/**
 * 邮件收件人管理路由
 */
export const emailRouter = router({
  // 获取收件人列表
  getList: publicProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      const { isActive, page, pageSize } = input;
      const skip = (page - 1) * pageSize;
      const prisma = prismaService.getPrismaClient();

      const where: any = {};
      if (isActive !== undefined) where.isActive = isActive;

      const [total, results] = await Promise.all([
        prisma.emailRecipient.count({ where }),
        prisma.emailRecipient.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return {
        success: true,
        data: {
          total,
          page,
          pageSize,
          list: results,
        },
      };
    }),

  // 添加收件人
  create: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const prisma = prismaService.getPrismaClient();

      const recipient = await prisma.emailRecipient.create({
        data: input,
      });

      return {
        success: true,
        data: recipient,
      };
    }),

  // 更新收件人
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const prisma = prismaService.getPrismaClient();

      const recipient = await prisma.emailRecipient.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        data: recipient,
      };
    }),

  // 删除收件人
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const prisma = prismaService.getPrismaClient();
      await prisma.emailRecipient.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
