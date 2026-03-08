import { NextRequest, NextResponse } from "next/server";
import { checkSLABreaches } from "@/lib/notification-service";
import { timingSafeEqual } from "crypto";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? "";

  if (!secret || !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await checkSLABreaches();
  return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
}
