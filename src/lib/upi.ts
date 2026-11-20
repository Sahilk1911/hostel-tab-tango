export function isValidUpi(id: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(id.trim());
}

/** Standard UPI deep link (NPCI spec). Opens GPay / PhonePe / Paytm with the amount pre-filled. */
export function buildUpiLink(opts: { upi: string; name: string; amountPaise: number; note: string }): string {
  const params = new URLSearchParams({
    pa: opts.upi.trim(),
    pn: opts.name,
    am: (opts.amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 50),
  });
  // Keep "@" readable in the payee address: some UPI apps reject an encoded %40.
  return `upi://pay?${params.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}
