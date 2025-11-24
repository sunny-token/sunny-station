import { router } from "./trpc";
import { dltRouter } from "./routes/dltRoute";
import { ssqRouter } from "./routes/ssqRoute";
import { ticketRouter } from "./routes/ticketRoute";
import { emailRouter } from "./routes/emailRoute";

export const appRouter = router({
  dlt: dltRouter,
  ssq: ssqRouter,
  ticket: ticketRouter,
  email: emailRouter,
});

export type AppRouter = typeof appRouter;
