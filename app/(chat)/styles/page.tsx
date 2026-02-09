import { redirect } from "next/navigation";
import { StyleManager } from "@/components/style-manager";
import { auth } from "../../(auth)/auth";

export default async function StylesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <StyleManager />;
}
