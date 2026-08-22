import type { Killer } from "@/lib/tournament";
import { Avatar } from "./Avatar";

/**
 * A killer's small avatar + name. On hover it reveals an enlarged avatar
 * tooltip (pure CSS, no client JS), along with their seed where the year's data
 * has one — it decides ties the standings columns leave level, so it wants to
 * be findable somewhere. `align` controls which side the tooltip anchors to so
 * it never runs off the row.
 */
export function KillerChip({
  killer,
  align = "left",
  reverse = false,
}: {
  killer: Killer;
  align?: "left" | "right";
  reverse?: boolean;
}) {
  return (
    <span
      className={`group/killer relative inline-flex items-center gap-2 ${
        reverse ? "flex-row-reverse" : ""
      }`}
    >
      <Avatar killer={killer} size={26} />
      <span className="truncate font-medium">{killer.name}</span>

      {/* Enlarged avatar tooltip shown on hover */}
      <span
        className={`pointer-events-none absolute bottom-full z-20 mb-2 flex flex-col items-center gap-1 rounded-xl border border-black/10 bg-white p-2 opacity-0 shadow-xl transition-opacity duration-150 group-hover/killer:opacity-100 dark:border-white/15 dark:bg-zinc-900 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <Avatar killer={killer} size={96} />
        <span className="whitespace-nowrap text-xs font-semibold">
          {killer.name}
        </span>
        {killer.seeding !== undefined && (
          <span className="whitespace-nowrap text-[10px] text-zinc-500 dark:text-zinc-400">
            Seed #{killer.seeding}
          </span>
        )}
      </span>
    </span>
  );
}
