import { redirect } from "next/navigation";
import { ProjectManager } from "@/components/project-manager";
import { auth } from "../../(auth)/auth";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ProjectManager />;
}
