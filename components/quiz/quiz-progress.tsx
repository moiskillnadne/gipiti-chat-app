"use client";

import { cn } from "@/lib/utils";
import styles from "./quiz-wizard.module.css";
import type { ProgressStyle } from "./types";

type QuizProgressProps = {
  variant: ProgressStyle;
  current: number;
  total: number;
};

export function QuizProgress({ variant, current, total }: QuizProgressProps) {
  const pct = Math.round((current / total) * 100);
  // Value-based keys (not the map index) to satisfy noArrayIndexKey.
  const cells = Array.from({ length: total }, (_, index) => `cell-${index}`);

  if (variant === "counter") {
    return (
      <div className={cn(styles.prog, styles.progCounter)}>
        <span className={styles.progNum}>
          <b>{String(current).padStart(2, "0")}</b> /{" "}
          {String(total).padStart(2, "0")}
        </span>
        <span className={styles.progRule}>
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className={cn(styles.prog, styles.progBar)}>
        <span className={styles.progTrack}>
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className={styles.progPct}>{pct}%</span>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={cn(styles.prog, styles.progDots)}>
        {cells.map((cellKey, index) => (
          <span
            className={cn(
              styles.dot,
              index < current && styles.done,
              index === current - 1 && styles.now
            )}
            key={cellKey}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(styles.prog, styles.progSeg)}>
      {cells.map((cellKey, index) => (
        <span
          className={cn(styles.seg, index < current && styles.done)}
          key={cellKey}
        />
      ))}
    </div>
  );
}
