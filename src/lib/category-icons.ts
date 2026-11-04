import iconBirthdayCakes from "@/assets/category-icon-birthday-cakes.png";
import iconWeddingCakes from "@/assets/category-icon-wedding-cakes.png";
import iconKidsCakes from "@/assets/category-icon-kids-cakes.png";
import iconHolyCommunion from "@/assets/category-icon-holy-communion.png";
import iconBirthdayBash from "@/assets/category-icon-birthday-bash.png";
import iconPartyEssentials from "@/assets/category-icon-party-essentials.png";
import iconNewArrivals from "@/assets/category-icon-new-arrivals.png";
import iconAnniversary from "@/assets/category-icon-anniversary.svg";

// Per-category icons for the header nav and the phone tab bar — anything not in this list (a category the shop
// owner adds themselves from /manage) falls back to the generic CakeSlice icon.
export const CATEGORY_ICONS: Record<string, string> = {
  "birthday-cakes": iconBirthdayCakes,
  "wedding-cakes": iconWeddingCakes,
  "kids-cakes": iconKidsCakes,
  "holy-communion-cakes": iconHolyCommunion,
  "birthday-bash": iconBirthdayBash,
  "party-essentials": iconPartyEssentials,
  "new-arrivals": iconNewArrivals,
  "anniversary-cakes": iconAnniversary,
};
