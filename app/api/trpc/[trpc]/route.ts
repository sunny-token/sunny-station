import { appRouter } from "@/server";
import { createContext } from "@/server/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// AI 调用可能需要 20-30 秒，Vercel 默认超时仅 10 秒，需要延长
export const maxDuration = 60;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
      if (error.cause) {
        console.error("Error cause:", error.cause);
      }
    },
  });

export { handler as GET, handler as POST };
