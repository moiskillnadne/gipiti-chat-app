import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { StyleDetail } from "@/components/style-detail";
import { getTextStyleById } from "@/lib/db/queries";

export default async function StyleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const style = await getTextStyleById({ id });

  if (!style || style.userId !== session.user.id) {
    redirect("/styles");
  }

  return <StyleDetail initialStyle={style} />;
}
