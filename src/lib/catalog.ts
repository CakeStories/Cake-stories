import bentoAsset from "@/assets/cake-bento.jpg.asset.json";
import vanillaAsset from "@/assets/cake-vanilla.jpg.asset.json";
import cheesecakeAsset from "@/assets/cake-cheesecake.jpg.asset.json";
import tresLechesAsset from "@/assets/cake-tres-leches.jpg.asset.json";
import tiramisuAsset from "@/assets/cake-tiramisu.jpg.asset.json";
import dryCakeAsset from "@/assets/cake-dry-cake.jpg.asset.json";
import salankatiaAsset from "@/assets/cake-salankatia.jpg.asset.json";
import photoCakeAsset from "@/assets/cake-photo-cake.jpg.asset.json";
import cupcakeAsset from "@/assets/cake-cupcake.jpg.asset.json";
import jarCakeAsset from "@/assets/cake-jar-cake.jpg.asset.json";
import oreoAsset from "@/assets/cake-oreo.jpg.asset.json";
import pinataAsset from "@/assets/cake-pinata.jpg.asset.json";

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
  { slug: "new-arrivals", label: "New Arrivals" },
];

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string; // primary category slug
  price: number; // INR, rupees
  mrp?: number; // strike-through price if on sale
  image: string;
  badge?: "Best Seller" | "New Arrival" | "Trending";
  description: string;
  weight: string;
  classicToCreative?: boolean; // featured in the homepage "From classic to creative" rail
};

// Product names and prices for the first 24 items are sourced from the live
// "Shop All" listing at cakestories.in; the rest are the storefront's own
// classic-to-creative range.
export const products: Product[] = [
  {
    id: "white-forest-cake",
    slug: "white-forest-cake",
    name: "White Forest Cake",
    category: "holy-communion-cakes",
    price: 899,
    image: vanillaAsset.url,
    description:
      "A lighter twist on the classic — white chocolate shavings and whipped cream, in the soft white palette fitting for a Holy Communion table.",
    weight: "1 kg",
  },

  // "From classic to creative" range
  {
    id: "bento-cake",
    slug: "bento-cake",
    name: "Bento Cake",
    category: "party-essentials",
    price: 549,
    image: bentoAsset.url,
    description:
      "A cute, individually-sized 4-inch cake in a box — perfect for a small celebration.",
    weight: "250 g",
    classicToCreative: true,
  },
  {
    id: "vanilla-cake",
    slug: "vanilla-cake",
    name: "Vanilla Cake",
    category: "holy-communion-cakes",
    price: 649,
    image: vanillaAsset.url,
    description: "A timeless vanilla sponge with light whipped cream — simple and elegant.",
    weight: "1 kg",
    classicToCreative: true,
  },
  {
    id: "cheese-cake",
    slug: "cheese-cake",
    name: "Cheese Cake",
    category: "party-essentials",
    price: 899,
    image: cheesecakeAsset.url,
    description: "A baked, creamy cheesecake with a buttery biscuit base.",
    weight: "750 g",
    classicToCreative: true,
  },
  {
    id: "tres-leches",
    slug: "tres-leches",
    name: "Tres Leches",
    category: "party-essentials",
    price: 799,
    image: tresLechesAsset.url,
    description: "A soft milk-soaked sponge cake, finished with a light whipped topping.",
    weight: "1 kg",
    classicToCreative: true,
  },
  {
    id: "tiramisu-cake",
    slug: "tiramisu-cake",
    name: "Tiramisu Cake",
    category: "party-essentials",
    price: 899,
    image: tiramisuAsset.url,
    description: "Coffee-soaked layers with mascarpone cream and a dusting of cocoa.",
    weight: "750 g",
    classicToCreative: true,
  },
  {
    id: "dry-cake",
    slug: "dry-cake",
    name: "Dry Cake",
    category: "party-essentials",
    price: 499,
    image: dryCakeAsset.url,
    description: "An eggless butter sponge loaf, lightly sweet and perfect with chai.",
    weight: "500 g",
    classicToCreative: true,
  },
  {
    id: "salankatia",
    slug: "salankatia",
    name: "Salankatia",
    category: "party-essentials",
    price: 749,
    image: salankatiaAsset.url,
    description: "A regional specialty cake, layered with a delicately spiced cream.",
    weight: "750 g",
    classicToCreative: true,
  },
  {
    id: "photo-cake",
    slug: "photo-cake",
    name: "Photo Cake",
    category: "birthday-cakes",
    price: 999,
    image: photoCakeAsset.url,
    description: "A vanilla or chocolate cake topped with an edible print of your favourite photo.",
    weight: "1 kg",
    classicToCreative: true,
  },
  {
    id: "cupcake",
    slug: "cupcake",
    name: "Cupcake",
    category: "kids-cakes",
    price: 399,
    image: cupcakeAsset.url,
    description: "A box of 6 freshly baked cupcakes with swirled buttercream.",
    weight: "6 pieces",
    classicToCreative: true,
  },
  {
    id: "oreo-cake",
    slug: "oreo-cake",
    name: "Oreo Cake",
    category: "kids-cakes",
    price: 749,
    image: oreoAsset.url,
    description: "Chocolate sponge loaded with crushed Oreo cookies and cream.",
    weight: "1 kg",
    classicToCreative: true,
  },
  {
    id: "pinata-cake",
    slug: "pinata-cake",
    name: "Pinata Cake",
    category: "kids-cakes",
    price: 1099,
    image: pinataAsset.url,
    description:
      "A hollow chocolate shell cake filled with candy — break it open to reveal the surprise inside.",
    weight: "1.5 kg",
    classicToCreative: true,
  },
  {
    id: "jar-cake",
    slug: "jar-cake",
    name: "Jar Cake",
    category: "party-essentials",
    price: 349,
    image: jarCakeAsset.url,
    description: "Layered cake and cream served in a reusable jar — easy to share, easy to gift.",
    weight: "200 g",
    classicToCreative: true,
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

const flavourKeywords: Record<string, string[]> = {
  "choco-truffle": ["chocolate truffle", "choco truffle"],
  "romantic-red-velvet": ["red velvet"],
  "white-forest": ["white forest"],
  "black-forest": ["black forest"],
  rasamalai: ["rasmalai"],
  "vancho-cake": ["vancho"],
  "dream-cake": ["dream cake"],
  "black-currant": ["black currant", "blackcurrant"],
  strawberry: ["strawberry"],
  pineapple: ["pineapple"],
  kiwi: ["kiwi"],
  mango: ["mango"],
  blueberry: ["blueberry"],
  "cheese-cake": ["cheese cake", "cheesecake"],
};

export function getProductsByFlavour(slug: string): Product[] {
  const keywords = flavourKeywords[slug] ?? [];
  if (!keywords.length) return [];
  return products.filter((product) => {
    const haystack = `${product.name} ${product.description}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

export function getFlavourLabel(slug: string): string {
  const labels: Record<string, string> = {
    "choco-truffle": "Choco Truffle",
    "romantic-red-velvet": "Romantic Red Velvet",
    "white-forest": "White Forest",
    "black-forest": "Black Forest",
    rasamalai: "Rasamalai",
    "vancho-cake": "Vancho Cake",
    "dream-cake": "Dream Cake",
    "black-currant": "Black Currant",
    strawberry: "Strawberry",
    pineapple: "Pineapple",
    kiwi: "Kiwi",
    mango: "Mango",
    blueberry: "Blueberry",
    "cheese-cake": "Cheese Cake",
  };
  return labels[slug] ?? slug.replaceAll("-", " ");
}

export function getProductsByCategory(slug: string): Product[] {
  if (slug === "new-arrivals") {
    return products.filter((p) => p.badge === "New Arrival" || p.badge === "Trending");
  }
  return products.filter((p) => p.category === slug);
}

export function getClassicToCreativeProducts(): Product[] {
  return products.filter((p) => p.classicToCreative);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
