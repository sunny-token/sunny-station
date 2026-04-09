import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import prismaService from "../../lib/prismaService";
import { hashPassword, verifyPassword, signToken } from "../../lib/auth";
import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";

// 内存中的简易频率限制器 (生产环境建议使用 Redis)
const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();

export const authRouter = router({
  // 注册接口 (包含频率限制和开关)
  register: publicProcedure
    .input(z.object({
      email: z.string().email("无效的邮箱格式"),
      password: z.string().min(6, "密码不能少于 6 位"),
      name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. 检查注册开关
      const isRegistrationAllowed = process.env.ALLOW_REGISTRATION !== "false";
      if (!isRegistrationAllowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "系统当前已关闭注册功能" });
      }

      // 2. 简易频率限制 (基于 IP)
      const ip = ctx.ip;
      const now = Date.now();
      const limitWindow = 10 * 60 * 1000; // 10 分钟
      const maxRequests = 3;

      const userLimit = rateLimitMap.get(ip);
      if (userLimit) {
        if (now - userLimit.lastRequest < limitWindow) {
          if (userLimit.count >= maxRequests) {
            throw new TRPCError({ 
              code: "TOO_MANY_REQUESTS", 
              message: "请求过于频繁，请 10 分钟后再试" 
            });
          }
          userLimit.count += 1;
        } else {
          // 重置窗口
          userLimit.count = 1;
          userLimit.lastRequest = now;
        }
      } else {
        rateLimitMap.set(ip, { count: 1, lastRequest: now });
      }

      const { email, password, name } = input;
      const prisma = prismaService.getPrismaClient();
      
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "邮箱已被注册" });
      }

      const hashedPassword = await hashPassword(password);
      
      // 默认第一个注册的用户为 ADMIN，后续的都是 USER
      const userCount = await prisma.user.count();
      const role = userCount === 0 ? "ADMIN" : "USER";

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
        },
      });

      return {
        success: true,
        user: { id: user.id, email: user.email, role: user.role }
      };
    }),

  // 登录接口
  login: publicProcedure
    .input(z.object({
      email: z.string().email("无效的邮箱格式"),
      password: z.string().min(1, "请输入密码"),
    }))
    .mutation(async ({ input }) => {
      const { email, password } = input;
      const prisma = prismaService.getPrismaClient();
      
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.isActive === false) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
      }

      // 签发 JWT
      const token = await signToken({ userId: user.id, role: user.role });
      
      // 将 Token 写入 HttpOnly Cookie
      const cookieStore = await cookies();
      cookieStore.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return {
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      };
    }),

  // 登出接口
  logout: publicProcedure
    .mutation(async () => {
      const cookieStore = await cookies();
      cookieStore.delete("auth_token");
      return { success: true };
    }),

  // 获取当前登录用户信息
  getMe: protectedProcedure
    .query(async ({ ctx }) => {
      const prisma = prismaService.getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.userId },
        select: { id: true, email: true, name: true, role: true, createdAt: true }
      });
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }
      return user;
    }),
});
