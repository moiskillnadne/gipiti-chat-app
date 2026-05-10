import { redirect } from "next/navigation";
import { AccountPageTopNav } from "@/components/account-page-top-nav";
import { ProjectManager } from "@/components/project-manager";
import { auth } from "../../(auth)/auth";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AccountPageTopNav currentLabelKey="projects" />
      <ProjectManager />
    </>
  );
}
