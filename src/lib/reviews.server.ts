import { createServerFn } from "@tanstack/react-start";
import { serverEnv } from "@/lib/env.server";

// Pulls live reviews from your Google Business Profile via the Places API
// (New). Requires GOOGLE_PLACE_ID and GOOGLE_PLACES_API_KEY as server env
// vars — see .env.example for where to get these. Both stay server-side;
// nothing here is exposed to the browser.

export type GoogleReview = {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhoto?: string;
};

export type GoogleReviewsResult =
  | { configured: true; rating: number; totalReviews: number; reviews: GoogleReview[] }
  | { configured: false };

export const getGoogleReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleReviewsResult> => {
    const placeId = serverEnv("GOOGLE_PLACE_ID");
    const apiKey = serverEnv("GOOGLE_PLACES_API_KEY");

    if (!placeId || !apiKey) {
      return { configured: false };
    }

    const url = `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount,reviews`;
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey },
    });

    if (!response.ok) {
      throw new Error(`Google Places API request failed: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      rating?: number;
      userRatingCount?: number;
      reviews?: {
        authorAttribution?: { displayName?: string; photoUri?: string };
        rating?: number;
        text?: { text?: string };
        relativePublishTimeDescription?: string;
      }[];
    };

    return {
      configured: true,
      rating: data.rating ?? 0,
      totalReviews: data.userRatingCount ?? 0,
      reviews: (data.reviews ?? []).slice(0, 6).map((r) => ({
        author: r.authorAttribution?.displayName ?? "Google user",
        rating: r.rating ?? 5,
        text: r.text?.text ?? "",
        relativeTime: r.relativePublishTimeDescription ?? "",
        profilePhoto: r.authorAttribution?.photoUri,
      })),
    };
  },
);
