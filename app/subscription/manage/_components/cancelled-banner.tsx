import { getTranslations } from "@/lib/i18n/translate";
import dash from "../../_components/dashboard.module.css";
import { InfoIcon } from "../../_components/icons";
import type { ResumeDialogData } from "./manage-types";
import { ResumeButton } from "./resume-button";

type CancelledBannerProps = {
  dateFull: string;
  subAmount: string;
  topupAmount: string;
  resumeData: ResumeDialogData;
};

export async function CancelledBanner({
  dateFull,
  subAmount,
  topupAmount,
  resumeData,
}: CancelledBannerProps) {
  const t = await getTranslations("auth.subscription.manage.banner");

  return (
    <div
      className={`${dash.banner} ${dash.bannerCancelled} ${dash.marginBottom16}`}
    >
      <InfoIcon className={dash.bannerIcon} />
      <div className={dash.bannerBody}>
        <b>{t("title", { date: dateFull })}</b>
        <span>{t("body", { subAmount, topupAmount })}</span>
      </div>
      <div className={dash.bannerActions}>
        <ResumeButton data={resumeData} label={t("resume")} variant="outline" />
      </div>
    </div>
  );
}
