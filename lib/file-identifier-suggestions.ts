/**
 * Conservative HW/SW candidate extraction for the private original-file library.
 * Suggestions are never automatically written to the catalog.
 * ECU binary contents are intentionally not parsed or shared.
 */
export type IdentifierSuggestion = {
  hwId: string | null;
  swId: string | null;
  source: "filename" | "none";
  needsReview: true;
};

export function suggestFileIdentifiers(filename: string): IdentifierSuggestion {
  const base = filename.replace(/\.[^.]+$/, "");
  // Only accept clearly labelled identifiers; ambiguous part numbers stay Undefined.
  const pattern = /(?:^|[\\s_.-])(HW|HARDWARE|SW|SOFTWARE)[\\s_=:-]+([A-Za-z0-9]{2,80})(?=$|[\\s_.-])/gi;
  const matches: Record<string,string> = {};
  for (const match of base.matchAll(pattern)) {
    const key = /^(?:HW|HARDWARE)$/i.test(match[1]) ? "hw" : "sw";
    const value = match[2]?.toUpperCase();
    if (value && !matches[key]) matches[key] = value;
  }
  return {
    hwId: matches.hw || null,
    swId: matches.sw || null,
    source: matches.hw && matches.sw ? "filename" : "none",
    needsReview: true,
  };
}
