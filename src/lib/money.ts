/** All amounts are stored as integer paise to avoid floating-point drift. */
export function toPaise(rupees: string | number): number {
  const n = typeof rupees === "number" ? rupees : parseFloat(rupees.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}

const fmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number): string {
  return fmt.format(paise / 100);
}

/** Split `total` into integer parts proportional to `weights`, summing exactly to total (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map((r) => Math.floor(r));
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) {
    const idx = order[k % order.length]!.i;
    base[idx] = base[idx]! + 1;
  }
  return base;
}
