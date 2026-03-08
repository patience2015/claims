import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const NOTIFICATION_TYPES = [
  "CLAIM_ASSIGNED", "STATUS_CHANGED", "FRAUD_ALERT",
  "SLA_BREACH", "DOCUMENT_UPLOADED_BY_POLICYHOLDER",
] as const;

const PreferencesSchema = z.array(z.object({
  type: z.enum(NOTIFICATION_TYPES),
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
})).min(1);

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "POLICYHOLDER") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  });

  // Lazy-init si absent
  if (prefs.length === 0) {
    const defaults = NOTIFICATION_TYPES.map((type) => ({
      userId: session.user.id,
      type,
      emailEnabled: true,
      inAppEnabled: true,
    }));
    await prisma.notificationPreference.createMany({ data: defaults });
    return NextResponse.json({ data: defaults });
  }

  return NextResponse.json({ data: prefs });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "POLICYHOLDER") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });

  const updated = await Promise.all(
    parsed.data.map((pref) =>
      prisma.notificationPreference.upsert({
        where: { userId_type: { userId: session.user.id, type: pref.type } },
        update: { emailEnabled: pref.emailEnabled, inAppEnabled: pref.inAppEnabled },
        create: { userId: session.user.id, ...pref },
      })
    )
  );

  await createAuditLog({
    action: "NOTIFICATION_PREFERENCES_UPDATED",
    entityType: "USER",
    entityId: session.user.id,
    after: { preferences: parsed.data },
    userId: session.user.id,
  });

  return NextResponse.json({ data: updated });
}
