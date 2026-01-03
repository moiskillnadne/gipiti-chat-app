type CheckIconProps = {
  className?: string;
};

export function CheckIcon({ className }: CheckIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Check icon</title>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

