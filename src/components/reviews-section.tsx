import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getGoogleReviews } from "@/lib/reviews.server";

/**
 * Live Google reviews. The whole section stays hidden until reviews are
 * connected (GOOGLE_PLACE_ID / GOOGLE_PLACES_API_KEY, see .env.example) and
 * actually return something — visitors never see a setup message or an error.
 */
export function ReviewsSection() {
  const { data } = useQuery({
    queryKey: ["google-reviews"],
    queryFn: () => getGoogleReviews(),
    staleTime: 60 * 60 * 1000,
  });

  if (!data?.configured || data.reviews.length === 0) return null;

  return (
    <section className="bg-cream py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <h2 className="font-display text-3xl">Customer reviews</h2>
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm">
            <Star size={16} className="fill-primary text-primary" />
            <strong>{data.rating.toFixed(1)}</strong>
            <span className="text-muted-foreground">({data.totalReviews} Google reviews)</span>
          </div>
          <div className="scrollbar-none mt-5 flex snap-x gap-4 overflow-x-auto pb-3">
            {data.reviews.map((review, i) => (
              <article
                key={i}
                className="w-72 shrink-0 snap-start rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star
                      key={star}
                      size={13}
                      className={
                        star < review.rating ? "fill-primary text-primary" : "text-muted-foreground"
                      }
                    />
                  ))}
                </div>
                <p className="mt-2 line-clamp-4 text-sm text-foreground/85">{review.text}</p>
                <p className="mt-3 text-xs font-semibold text-foreground">{review.author}</p>
                <p className="text-xs text-muted-foreground">{review.relativeTime}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
