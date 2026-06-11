"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n/translate";
import dash from "../../_components/dashboard.module.css";
import { CancelFlowDialog } from "./cancel-flow-dialog";
import type { CancelDialogData } from "./manage-types";

type CancelButtonProps = {
  data: CancelDialogData;
};

export function CancelButton({ data }: CancelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("auth.subscription.manage.strip");

  return (
    <>
      <button
        className={`${dash.btn} ${dash.btnDanger} ${dash.btnSm}`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {t("cancelButton")}
      </button>
      <CancelFlowDialog data={data} isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
