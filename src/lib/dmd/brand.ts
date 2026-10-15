// Corrects brand spellings in account labels entered by hand (e.g. through the
// secure secret forms), so "NAmeCheap Ardexa" shows as "Namecheap Ardexa".
const BRANDS: [RegExp, string][] = [
  [/\bname[\s_-]?cheap\b/i, "Namecheap"],
  [/\bgo[\s_-]?daddy\b/i, "GoDaddy"],
];

export function fixBrandCasing(label: string): string {
  let out = label;
  for (const [pattern, brand] of BRANDS) out = out.replace(pattern, brand);
  return out;
}
