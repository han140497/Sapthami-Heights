/**
 * Money is paise (integer) everywhere in this app. It becomes a rupee string only
 * at the last moment, for display. It is never parsed back from a formatted string
 * and never stored as a float.
 */

/** 123456 paise -> "₹1,234.56". Indian digit grouping (lakh/crore). */
export function formatPaise(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  const grouped = rupees.toLocaleString("en-IN");
  const paiseStr = remainder.toString().padStart(2, "0");
  return `${negative ? "-" : ""}₹${grouped}.${paiseStr}`;
}

/** "1234.56" or "1234" (rupees, from a form) -> 123456 paise. Throws on garbage. */
export function rupeesToPaise(input: string | number): number {
  const str = String(input).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error(`not a valid rupee amount: ${input}`);
  }
  const negative = str.startsWith("-");
  const [rupees, frac = ""] = str.replace(/^-/, "").split(".");
  const paise = Number(rupees) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -paise : paise;
}

/** Paise as a plain decimal string "1234.56" for input fields (no symbol, no grouping). */
export function paiseToRupeeInput(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}
