import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MainLayout } from "@/components/layout/main-layout";
import { RiskHeatmapPanel } from "@/components/risk/RiskHeatmapPanel";

export default async function RiskHeatmapPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as string;
  if (!["MANAGER", "ADMIN"].includes(role)) redirect("/claims");

  return (
    <MainLayout>
      <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Intelligence prédictive</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
              Carte de risque
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Distribution géographique des scores de risque assurés</p>
          </div>
        </div>

        <RiskHeatmapPanel />
      </div>
    </MainLayout>
  );
}
