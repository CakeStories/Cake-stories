const FLAVOUR_LABELS: Record<string, string> = {
  "Hony Almnds": "Honey Almonds",
  Pitsachio: "Pistachio",
  Rasamalai: "Rasmalai",
  Casatta: "Cassata",
};

/** Cleans up known typos/abbreviations from source spreadsheets. Unknown flavours pass through unchanged. */
export function flavourLabel(flavour: string): string {
  return FLAVOUR_LABELS[flavour] ?? flavour;
}
