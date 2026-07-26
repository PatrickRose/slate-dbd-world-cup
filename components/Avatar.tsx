import type { Killer } from "@/lib/tournament";

/** Deterministic pleasant colour derived from the killer id. */
function hueFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return hash;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Round killer avatar. Uses the killer's `avatar` image when supplied,
 * otherwise renders a coloured initials badge so the UI is complete before
 * any real portraits are added to /public.
 */
export function Avatar({
  killer,
  size = 28,
}: {
  killer: Killer;
  size?: number;
}) {
  const dimension = { width: size, height: size };

  if (killer.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are small, local, and swappable at runtime
      <img
        src={killer.avatar}
        alt={killer.name}
        style={dimension}
        className="rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
      />
    );
  }

  const hue = hueFor(killer.id);
  return (
    <span
      style={{
        ...dimension,
        background: `hsl(${hue} 55% 42%)`,
        fontSize: Math.round(size * 0.4),
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/10 dark:ring-white/15"
      aria-hidden
    >
      {initials(killer.name)}
    </span>
  );
}
