import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["MANAGER", "ADMIN"].includes(session.user.role as string)) redirect("/claims");
  return <>{children}</>;
}
