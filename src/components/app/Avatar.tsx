import { cn } from "@/lib/utils";

const tones = ["bg-marigold", "bg-gain-soft", "bg-owe-soft", "bg-accent", "bg-secondary"];

function tone(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-display font-bold text-ink",
        size === "sm" ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-sm",
        tone(name),
        className,
      )}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
