// The last-known category list, shown in the header nav instantly while the
// live list loads from the database. Kept apart from catalog.ts so the header
// (on every page) doesn't pull in catalog's embedded product photos.
export type Category = {
  slug: string;
  label: string;
};

export const categories: Category[] = [
  { slug: "birthday-cakes", label: "Birthday Cakes" },
  { slug: "wedding-cakes", label: "Wedding Cakes" },
  { slug: "kids-cakes", label: "Kids Cakes" },
  { slug: "holy-communion-cakes", label: "Holy Communion" },
  { slug: "birthday-bash", label: "Birthday Bash" },
  { slug: "party-essentials", label: "Party Essentials" },
  { slug: "anniversary-cakes", label: "Anniversary" },
  { slug: "new-arrivals", label: "Christmas" },
];
