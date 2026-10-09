const EXPANSIONS: Readonly<Record<string, string>> = {
  sta: "santa",
  sto: "santo",
  brgy: "barangay",
  ave: "avenue",
};

export function normalize(text: string): string {
  const tokens = text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (tokens === "") {
    return "";
  }
  return tokens
    .split(" ")
    .map((token) => EXPANSIONS[token] ?? token)
    .join(" ");
}
