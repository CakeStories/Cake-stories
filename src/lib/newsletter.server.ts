import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { customerSafe, rateLimit } from "@/lib/public-guard.server";
import { serviceRest } from "@/lib/service.server";

/** Saves a footer newsletter sign-up. Signing up twice is a harmless no-op. */
export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(data),
  )
  .handler(async ({ data }) =>
    customerSafe(async () => {
      await rateLimit("newsletter", 5, 60 * 60_000);
      await serviceRest("newsletter_subscribers?on_conflict=email", {
        method: "POST",
        body: { email: data.email },
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      });
      return { subscribed: true };
    }),
  );
