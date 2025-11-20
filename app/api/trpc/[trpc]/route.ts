import { appRouter } from "@/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error, path }) => {
      console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
      if (error.cause) {
        console.error("Error cause:", error.cause);
      }
    },
  });

export { handler as GET, handler as POST };
