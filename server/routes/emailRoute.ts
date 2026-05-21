import { protectedProcedure, router } from "../trpc";
import prismaService from "../../lib/prismaService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * 邮件收件人管理路由（带账户安全隔离与鉴权）
 */
export const emailRouter = router({
  // 获取收件人列表（仅获取当前登录名下的）
  getList: protectedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { isActive, page, pageSize } = input;
      const skip = (page - 1) * pageSize;
      const prisma = prismaService.getPrismaClient();

      const where: any = { userId: ctx.user.userId };
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
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 访客拦截
      if (ctx.user.role === "GUEST") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "🔒 访客模式下无法添加通知节点",
        });
      }

      const prisma = prismaService.getPrismaClient();

      // 隐式绑定当前用户的 userId
      const recipient = await prisma.emailRecipient.create({
        data: {
          ...input,
          userId: ctx.user.userId,
        },
      });

      return {
        success: true,
        data: recipient,
      };
    }),

  // 更新收件人
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 访客拦截
      if (ctx.user.role === "GUEST") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "🔒 访客模式下无法修改通知配置",
        });
      }

      const { id, ...updateData } = input;
      const prisma = prismaService.getPrismaClient();

      // 防横向越权：必须校验该记录是否属于当前登录用户
      const existing = await prisma.emailRecipient.findFirst({
        where: { id, userId: ctx.user.userId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "未找到该通知节点，或您无权修改",
        });
      }

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
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // 访客拦截
      if (ctx.user.role === "GUEST") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "🔒 访客模式下无法删除通知配置",
        });
      }

      const prisma = prismaService.getPrismaClient();

      // 防横向越权：必须校验该记录是否属于当前登录用户
      const existing = await prisma.emailRecipient.findFirst({
        where: { id: input.id, userId: ctx.user.userId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "未找到该通知节点，或您无权删除",
        });
      }

      await prisma.emailRecipient.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
