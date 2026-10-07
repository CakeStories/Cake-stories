import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serviceRest } from "@/lib/service.server";

/** Saves a footer newsletter sign-up. Signing up twice is a harmless no-op. */
export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    await serviceRest("newsletter_subscribers?on_conflict=email", {
      method: "POST",
      body: { email: data.email },
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    });
    return { subscribed: true };
  });
