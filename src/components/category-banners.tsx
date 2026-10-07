import { Link } from "@tanstack/react-router";
import type { Banner } from "@/lib/banners";

function BannerImage({
  banner,
  className,
  imageClassName = "h-full w-full object-cover",
}: {
  banner: Banner;
  className: string;
  imageClassName?: string;
}) {
  return banner.external ? (
    <a
      href={banner.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={banner.label}
      className={`block overflow-hidden rounded-lg ${className}`}
    >
      <img src={banner.image} alt="" loading="lazy" className={imageClassName} />
    </a>
  ) : (
    <Link
      to={banner.href}
      aria-label={banner.label}
      className={`block overflow-hidden rounded-lg ${className}`}
    >
      <img src={banner.image} alt="" loading="lazy" className={imageClassName} />
    </Link>
  );
}

/**
 * Renders a category page's banners (fully admin-managed — image, link, and
 * order all come from /manage). One banner shows full-width at its natural
 * aspect ratio (nothing cropped). Two or more shows the first as a wide hero
 * — still uncropped — and the rest in a card row underneath, matching how a
 * seasonal "menu" page (e.g. Christmas) is usually laid out.
 */
export function CategoryBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  const [hero, ...rest] = banners;

  if (rest.length === 0) {
    return (
      <div className="mt-4">
        <BannerImage banner={hero} className="w-full" imageClassName="h-auto w-full" />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <BannerImage banner={hero} className="w-full" imageClassName="h-auto w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rest.map((banner) => (
          <BannerImage key={banner.id} banner={banner} className="aspect-[4/5] sm:aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}
