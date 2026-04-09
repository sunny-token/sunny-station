import { initTRPC, TRPCError } from "@trpc/server";
import SuperJSON from "superjson";
import { cookies } from "next/headers";
import { verifyToken } from "../lib/auth";

export const createContext = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  let user = null;
  if (token) {
    user = await verifyToken(token);
  }
  return { user };
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
