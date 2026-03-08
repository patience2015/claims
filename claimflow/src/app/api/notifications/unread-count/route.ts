import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "POLICYHOLDER") return NextResponse.json({ count: 0 });

  const count = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return NextResponse.json({ count }, {
    headers: { "Cache-Control": "no-store" },
  });
}
