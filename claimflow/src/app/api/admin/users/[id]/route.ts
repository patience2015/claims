import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UpdateUserSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notification-service";
import bcrypt from "bcryptjs";

const ROLE_LABELS: Record<string, string> = {
  HANDLER: "Gestionnaire",
  MANAGER: "Manager",
  ADMIN: "Administrateur",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Prevent admin from deactivating themselves
  if (id === session.user.id && parsed.data.active === false) {
    return NextResponse.json({ error: "Impossible de désactiver son propre compte" }, { status: 422 });
  }

  const { password, ...updateData } = parsed.data;
  const finalData: Record<string, unknown> = { ...updateData };
  if (password) {
    finalData.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: finalData,
    select: { id: true, email: true, name: true, role: true, active: true, updatedAt: true },
  });

  await createAuditLog({
    action: "USER_UPDATED",
    entityType: "USER",
    entityId: user.id,
    before: { name: existing.name, role: existing.role, active: existing.active },
    after: updateData,
    userId: session.user.id,
  });

  // Notify the affected user of changes to their account
  // Don't notify the admin who made the change
  if (user.id !== session.user.id) {
    const adminName = session.user.name ?? "Un administrateur";

    if (parsed.data.active === true && existing.active === false) {
      await createNotification({
        userId: user.id,
        type: "USER_ACTIVATED",
        title: "Votre compte a été activé",
        body: `${adminName} a réactivé votre compte ClaimFlow.`,
      });
    } else if (parsed.data.active === false && existing.active === true) {
      await createNotification({
        userId: user.id,
        type: "USER_DEACTIVATED",
        title: "Votre compte a été désactivé",
        body: `${adminName} a désactivé votre compte ClaimFlow.`,
      });
    }

    if (parsed.data.role && parsed.data.role !== existing.role) {
      const newRoleLabel = ROLE_LABELS[parsed.data.role] ?? parsed.data.role;
      const oldRoleLabel = ROLE_LABELS[existing.role] ?? existing.role;
      await createNotification({
        userId: user.id,
        type: "ROLE_CHANGED",
        title: "Votre rôle a été modifié",
        body: `${adminName} a changé votre rôle de ${oldRoleLabel} à ${newRoleLabel}.`,
      });
    }
  }

  return NextResponse.json({ data: user });
}
