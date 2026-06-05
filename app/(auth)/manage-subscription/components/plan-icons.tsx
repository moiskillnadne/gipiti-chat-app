type IconProps = {
  className?: string;
};

const baseProps = {
  "aria-hidden": true,
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className} strokeWidth={2.4}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className} strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className} strokeWidth={2}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className} strokeWidth={1.7}>
      <rect height="9" rx="2" width="16" x="4" y="11" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function CardIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className} strokeWidth={1.7}>
      <rect height="14" rx="2" width="20" x="2" y="5" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className} strokeWidth={1.7}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
