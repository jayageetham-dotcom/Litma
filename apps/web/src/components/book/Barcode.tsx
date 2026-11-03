/** EAN-13 barcode for an ISBN, drawn as SVG (scannable at print size). Returns null for an invalid ISBN. */
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map((p) => [...p].map((b) => (b === "0" ? "1" : "0")).join(""));
const G = R.map((p) => [...p].reverse().join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

const check13 = (d12: string) => (10 - ([...d12].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0) % 10)) % 10;

/** ISBN-10 or ISBN-13 (any hyphens/spaces) → 13 digits, or null. */
export function isbn13(isbn?: string | null): string | null {
  const s = (isbn ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) return check13(s.slice(0, 12)) === Number(s[12]) ? s : null;
  if (/^\d{9}[\dX]$/.test(s)) {
    const d12 = "978" + s.slice(0, 9);
    return d12 + check13(d12);
  }
  return null;
}

export function Barcode({ isbn, width = "34mm", color = "#000" }: { isbn?: string | null; width?: string; color?: string }) {
  const d = isbn13(isbn);
  if (!d) return null;
  const par = PARITY[Number(d[0])];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === "L" ? L : G)[Number(d[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[Number(d[i])];
  bits += "101";
  const q = 9; // quiet zone, modules
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  const bars: React.ReactNode[] = [];
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") bars.push(<rect key={i} x={q + i} y={0} width={1.02} height={guard(i) ? 56 : 50} />);
  const t = (s: string, x: number) => (
    <text x={x} y={63} fontSize={8} textAnchor="middle" fontFamily="'OCR B', 'Courier New', monospace" letterSpacing={1.4}>
      {s}
    </text>
  );
  return (
    <svg viewBox={`0 0 ${95 + 2 * q} 66`} style={{ width, display: "block" }} fill={color} role="img" aria-label={`ISBN ${d}`}>
      {bars}
      {t(d[0], q - 4)}
      {t(d.slice(1, 7), q + 3 + 21)}
      {t(d.slice(7), q + 50 + 21)}
    </svg>
  );
}
