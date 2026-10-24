/** Emoji for each Kids Cakes character tab, picked from words in its (admin-editable) name. */
const CHARACTER_ICONS: [RegExp, string][] = [
  [/bluey|bingo/, "🐶"],
  [/cocomelon|coco melon/, "🍉"],
  [/dora/, "🎒"],
  [/paw patrol|chase|skye/, "🐾"],
  [/peppa|pig/, "🐷"],
  [/spider/, "🕷️"],
  [/batman|bat man/, "🦇"],
  [/superman|super man|hero|avenger|hulk|captain/, "🦸"],
  [/barbie|princess|frozen|elsa/, "👸"],
  [/unicorn/, "🦄"],
  [/panda/, "🐼"],
  [/boss baby|baby/, "👶"],
  [/mickey|minnie/, "🐭"],
  [/minion/, "💛"],
  [/pokemon|pikachu/, "⚡"],
  [/dino/, "🦖"],
  [/mermaid/, "🧜‍♀️"],
  [/car|race|wheel/, "🏎️"],
  [/football|soccer/, "⚽"],
  [/cricket/, "🏏"],
  [/motu|patlu/, "🥟"],
];
export function characterIcon(label: string): string {
  const l = label.toLowerCase();
  return CHARACTER_ICONS.find(([re]) => re.test(l))?.[1] ?? "🎈";
}
