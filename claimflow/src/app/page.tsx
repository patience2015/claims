import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role === "HANDLER") redirect("/claims");
  if (role === "MANAGER") redirect("/dashboard");
  if (role === "ADMIN") redirect("/admin");
  redirect("/claims");
}
