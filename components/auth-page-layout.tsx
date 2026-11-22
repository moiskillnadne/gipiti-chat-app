"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "@/lib/i18n/translate";
import { SupportLink } from "./support-link";

type AuthPageLayoutProps = {
  children: ReactNode;
};

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  const tSupport = useTranslations("legal.support");

  // The page grows with the form and the support link sits in the flow below it, so the two
  // cannot overlap at any viewport height; the flex-1 area keeps a short form centred on md+.
  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      <main className="flex flex-1 items-start justify-center pt-12 md:items-center md:py-12">
        <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
          <Link className="flex justify-center" href="/">
            <Image alt="GIPITI" height={64} src="/icon.png" width={64} />
          </Link>
          {children}
        </div>
      </main>
      <footer className="flex justify-end p-4">
        <SupportLink
          linkText={tSupport("linkText")}
          text={tSupport("needHelp")}
        />
      </footer>
    </div>
  );
}
