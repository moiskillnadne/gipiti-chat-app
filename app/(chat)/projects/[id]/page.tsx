import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ProjectDetail } from "@/components/project-detail";
import { getProjectById } from "@/lib/db/queries";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const proj = await getProjectById({ id });

  if (!proj || proj.userId !== session.user.id) {
    redirect("/projects");
  }

  return <ProjectDetail initialProject={proj} />;
}
