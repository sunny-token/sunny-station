import { router, publicProcedure, createCallerFactory } from "./trpc";
import { dltRouter } from "./routes/dltRoute";
import { ssqRouter } from "./routes/ssqRoute";
import { ticketRouter } from "./routes/ticketRoute";
import { emailRouter } from "./routes/emailRoute";

export const appRouter = router({
  dlt: dltRouter,
  ssq: ssqRouter,
  ticket: ticketRouter,
  email: emailRouter,
  refreshAll: publicProcedure.mutation(async () => {
    // 一键刷新所有数据：同时刷新 SSQ 和 DLT
    // 直接创建子路由的 caller 来调用方法
    const createSSQCaller = createCallerFactory(ssqRouter);
    const createDLTCaller = createCallerFactory(dltRouter);
    const ssqCaller = createSSQCaller({});
    const dltCaller = createDLTCaller({});

    const [ssqResult, dltResult] = await Promise.all([
      ssqCaller.refreshAll(),
      dltCaller.refreshAll(),
    ]);
    return {
      success: true,
      ssq: ssqResult,
      dlt: dltResult,
    };
  }),
});

export type AppRouter = typeof appRouter;
