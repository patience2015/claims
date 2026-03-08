import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "POLICYHOLDER") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });
  if (notif.userId !== session.user.id) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: notif.readAt ?? new Date() },
  });

  await createAuditLog({
    action: "NOTIFICATION_READ",
    entityType: "NOTIFICATION",
    entityId: id,
    after: { read: true },
    userId: session.user.id,
  });

  return NextResponse.json({ data: updated });
}
