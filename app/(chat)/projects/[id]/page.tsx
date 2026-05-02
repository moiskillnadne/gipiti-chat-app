import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ProjectDetail } from "@/components/project-detail";
import { getProjectById, getProjectFiles } from "@/lib/db/queries";

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

  const files = await getProjectFiles({
    projectId: id,
    userId: session.user.id,
  });

  return <ProjectDetail initialFiles={files} initialProject={proj} />;
}
