import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server";
import { QueryClient } from "@tanstack/react-query";
import SuperJSON from "superjson";

export const queryClient = new QueryClient();
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL}/api/trpc`,
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
