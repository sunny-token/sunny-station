import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server";
import { QueryClient } from "@tanstack/react-query";
import SuperJSON from "superjson";

export const queryClient = new QueryClient();
const getBaseUrl = () => {
  // 1. **浏览器环境 (Client Side)**:
  //    如果应用程序在浏览器中运行，直接使用 window.location.origin
  //    因为 tRPC 调用和应用在同一个源下。
  if (typeof window !== "undefined") return window.location.origin;

  // 2. **Vercel 环境 (Serverless Function)**:
  //    如果是在 Vercel 的 Serverless Function 中运行（例如 SSR 或 SSG），
  //    Vercel 会自动设置 VERCEL_URL。
  //    注意：为了让它在客户端也可用，你需要使用 NEXT_PUBLIC_ 前缀，
  //    所以通常建议将 VERCEL_URL 映射到一个 NEXT_PUBLIC_ 变量。
  if (process.env.VERCEL_URL) {
    // 确保使用 https 协议
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. **开发环境 (Local)**:
  //    如果以上都不是（通常是本地开发）
  return `http://localhost:${process.env.PORT ?? 3000}`;
};
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: SuperJSON,
    }),
  ],
});
// import {
//   createWSClient,
//   httpBatchLink,
//   loggerLink,
//   wsLink,
//   type TRPCLink,
// } from "@trpc/client";
// import { createTRPCNext } from "@trpc/next";
// import type { AppRouter } from "@/server";
// import { ssrPrepass } from "@trpc/next/ssrPrepass";
// import type { NextPageContext } from "next";
// import superjson from "superjson";
// import { createTRPCContext } from "@trpc/tanstack-react-query";

// function getEndingLink(ctx: NextPageContext | undefined): TRPCLink<AppRouter> {
//   if (typeof window === "undefined") {
//     return httpBatchLink({
//       url: `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`,
//       transformer: superjson,
//       headers() {
//         if (!ctx?.req?.headers) {
//           return {};
//         }
//         return {
//           ...ctx.req.headers,
//           "x-ssr": "1",
//         };
//       },
//     });
//   }
//   const client = createWSClient({
//     url: process.env.NEXT_PUBLIC_WS_URL!,
//   });
//   return wsLink({
//     client,
//     transformer: superjson,
//   });
// }

// export function getBaseUrl() {
//   if (typeof window !== "undefined") return "";

//   if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

//   return `http://localhost:${process.env.PORT ?? 2022}`;
// }

// export const trpc = createTRPCNext<AppRouter>({
//   ssr: true,
//   ssrPrepass,
//   transformer: superjson,
//   config({ ctx }) {
//     return {
//       links: [
//         loggerLink({
//           enabled: (opts) =>
//             (process.env.NODE_ENV === "development" &&
//               typeof window !== "undefined") ||
//             (opts.direction === "down" && opts.result instanceof Error),
//         }),
//         getEndingLink(ctx),
//       ],

//       queryClientConfig: { defaultOptions: { queries: { staleTime: 60 } } },
//     };
//   },
// });
