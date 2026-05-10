import type { ModelSpeedLevel } from "@/lib/ai/model-speed";
import { cn } from "@/lib/utils";

const HEIGHTS = ["h-1", "h-[7px]", "h-[10px]", "h-3"] as const;

type SpeedGaugeProps = {
  level: ModelSpeedLevel;
  title?: string;
  className?: string;
};

export function SpeedGauge({ level, title, className }: SpeedGaugeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex h-3 items-end gap-[1.5px]", className)}
      title={title}
    >
      {HEIGHTS.map((heightClass, index) => {
        const isActive = index < level;
        return (
          <span
            className={cn(
              "w-[2.5px] rounded-[1px]",
              heightClass,
              isActive ? "bg-ink opacity-100" : "bg-ink-4 opacity-35"
            )}
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static gauge
            key={index}
          />
        );
      })}
    </span>
  );
}
