import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const QuerySchema = z.object({
  read: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role === "POLICYHOLDER") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });

  const { read, limit, cursor } = parsed.data;
  const where: Record<string, unknown> = { userId: session.user.id };
  if (read !== undefined) where.read = read === "true";
  if (cursor) where.id = { lt: cursor };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, type: true, title: true, body: true,
        read: true, readAt: true, claimId: true, createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].id : null;
  return NextResponse.json({ data: notifications, unreadCount, nextCursor });
}
