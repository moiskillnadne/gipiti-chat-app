import { redirect } from "next/navigation";
import notFound from "@/app/not-found";
import { ProjectDetail } from "@/components/project-detail";
import { isValidUUID } from "@/lib/utils";
import { auth } from "@/server/modules/auth/next-auth";
import { getProjectById } from "@/server/modules/projects/queries/get-project-by-id";
import { getProjectFiles } from "@/server/modules/projects/queries/get-project-files";

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

  if (!isValidUUID(id)) {
    return notFound();
  }

  const proj = await getProjectById({ id });

  if (!proj || proj.userId !== session.user.id) {
    return notFound();
  }

  const files = await getProjectFiles({
    projectId: id,
    userId: session.user.id,
  });

  return <ProjectDetail initialFiles={files} initialProject={proj} />;
}
