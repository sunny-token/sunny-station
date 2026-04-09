import { initTRPC, TRPCError } from "@trpc/server";
import SuperJSON from "superjson";
import { cookies } from "next/headers";
import { verifyToken } from "../lib/auth";

export const createContext = async (opts?: { req?: Request }) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  // 获取客户端 IP (用于频率限制)
  const headersList = await (await import("next/headers")).headers();
  const xForwardedFor = headersList.get("x-forwarded-for");
  const ip = xForwardedFor ? xForwardedFor.split(",")[0] : "127.0.0.1";

  let user = null;
  if (token) {
    user = await verifyToken(token);
  }
  return { user, ip };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const trpc = initTRPC.context<Context>().create({
  transformer: SuperJSON,
});

export const router = trpc.router;
export const publicProcedure = trpc.procedure;

const isAuthed = trpc.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const protectedProcedure = trpc.procedure.use(isAuthed);

const isAdmin = trpc.middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can perform this action" });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const adminProcedure = trpc.procedure.use(isAdmin);

export const { createCallerFactory } = trpc;
