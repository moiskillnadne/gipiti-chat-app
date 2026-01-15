"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SupportLink } from "./support-link";

type AuthPageLayoutProps = {
  children: ReactNode;
};

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  const tSupport = useTranslations("legal.support");

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        {children}
      </div>
      <SupportLink
        linkText={tSupport("linkText")}
        text={tSupport("needHelp")}
      />
    </div>
  );
}
