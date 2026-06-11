import { getTranslations } from "@/lib/i18n/translate";
import { CancelButton } from "./cancel-button";
import styles from "./manage.module.css";
import type { CancelDialogData, ResumeDialogData } from "./manage-types";
import { ResumeButton } from "./resume-button";

type ManageFooterStripProps = {
  isCancelled: boolean;
  dateFull: string;
  cancelData: CancelDialogData;
  resumeData: ResumeDialogData;
};

export async function ManageFooterStrip({
  isCancelled,
  dateFull,
  cancelData,
  resumeData,
}: ManageFooterStripProps) {
  const t = await getTranslations("auth.subscription.manage.strip");

  return (
    <div className={styles.strip}>
      <div className={styles.stripLhs}>
        <b>{isCancelled ? t("resumeTitle") : t("cancelTitle")}</b>
        <span>
          {isCancelled
            ? t("resumeBody", { date: dateFull })
            : t("cancelBody", { date: dateFull })}
        </span>
      </div>
      {isCancelled ? (
        <ResumeButton
          data={resumeData}
          label={t("resumeButton")}
          variant="primary"
        />
      ) : (
        <CancelButton data={cancelData} />
      )}
    </div>
  );
}
