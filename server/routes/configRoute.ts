import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { getSettings, updateSettings } from "../../lib/settings";

export const configRouter = router({
  get: protectedProcedure.query(() => {
    return getSettings();
  }),
  update: adminProcedure
    .input(
      z.object({
        enableFortunePrize: z.boolean(),
      })
    )
    .mutation(({ input }) => {
      return updateSettings(input);
    }),
});
