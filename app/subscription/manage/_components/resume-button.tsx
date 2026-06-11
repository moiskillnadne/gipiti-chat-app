"use client";

import { useState } from "react";
import dash from "../../_components/dashboard.module.css";
import { RefreshIcon } from "../../_components/icons";
import type { ResumeDialogData } from "./manage-types";
import { ResumeDialog } from "./resume-dialog";

type ResumeButtonProps = {
  data: ResumeDialogData;
  label: string;
  variant: "primary" | "outline";
};

export function ResumeButton({ data, label, variant }: ResumeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const variantClass =
    variant === "primary" ? dash.btnPrimary : dash.btnOutline;

  return (
    <>
      <button
        className={`${dash.btn} ${variantClass} ${dash.btnSm}`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {variant === "primary" && <RefreshIcon aria-label={label} />}
        {label}
      </button>
      <ResumeDialog data={data} isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
