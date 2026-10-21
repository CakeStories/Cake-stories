/**
 * "The Celebration Collection" on the homepage. Each tile opens a page that,
 * for now, lists its featured cake followed by every cake whose name matches
 * the collection's words (whole words, any category). When the exact contents
 * are decided, list them in `featured` (shown first, in that order) and
 * narrow or empty `words`.
 */
export type Collection = {
  slug: string;
  /** Label on the homepage tile. */
  label: string;
  /** Page heading. */
  title: string;
  intro: string;
  /** Photo for the homepage tile, in public/celebration-collection/. */
  image: string;
  /** Product slugs always shown first. */
  featured: string[];
  /** Whole words (Postgres regex fragments) matched against cake names. */
  words: string[];
};

export const COLLECTIONS: Collection[] = [
  {
    slug: "floral-cakes",
    label: "Floral Cakes",
    title: "Floral Cakes",
    intro: "Blooms, butterflies and garden-fresh designs for every celebration.",
    image: "/celebration-collection/celebration-tower.webp",
    featured: ["celebration-tower"],
    words: ["floral", "flowers?", "roses?", "blossoms?", "butterfly", "butterflies", "bloom", "garden", "petals?", "lavender", "daisy", "lily"],
  },
  {
    slug: "theme-cakes",
    label: "Theme Cakes",
    title: "Theme Cakes",
    intro: "Race cars, superheroes, construction sites and more — cakes built around a theme they love.",
    image: "/celebration-collection/race-day-rally.webp",
    featured: ["race-day-rally"],
    words: ["race", "racing", "cars?", "wheels", "hotwheels", "superman", "spider", "hero", "football", "cricket", "construction", "excavator", "builder", "captain", "safari", "space", "rocket", "rockstar", "jungle", "pilot"],
  },
  {
    slug: "bow-cakes",
    label: "Bow Cakes",
    title: "Bow Cakes",
    intro: "Pretty bows and ribbons for a sweet, elegant celebration.",
    image: "/celebration-collection/pink-ribbon-party.webp",
    featured: ["pink-ribbon-party"],
    words: ["bows?", "ribbons?"],
  },
  {
    slug: "baby-shower",
    label: "Baby Shower",
    title: "Baby Shower Cakes",
    intro: "Gender reveals and baby showers — cakes to welcome the newest little one.",
    image: "/celebration-collection/twinkle-gender-reveal.webp",
    featured: ["twinkle-gender-reveal"],
    words: ["shower", "gender", "reveal", "twinkle", "stork"],
  },
  {
    slug: "photo-cakes",
    label: "Photo Cakes",
    title: "Photo Cakes",
    intro: "Your favourite photo, printed on a freshly baked cake.",
    image: "/celebration-collection/cherry-love-memories.webp",
    featured: ["cherry-love-memories"],
    words: ["photo", "memories", "picture", "portrait"],
  },
  {
    slug: "first-birthday",
    label: "First Birthday Cakes",
    title: "First Birthday Cakes",
    intro: "Make their very first birthday unforgettable.",
    image: "/celebration-collection/pink-crown-princess.webp",
    featured: ["pink-crown-princess"],
    // "one", but not "One Year of Love" (an anniversary cake).
    words: ["first", "1st", "one(?!\\s+year)"],
  },
];

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}
