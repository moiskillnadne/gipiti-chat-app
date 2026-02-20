import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Управление подпиской",
  robots: { index: false, follow: false },
};

export default function ManageSubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
