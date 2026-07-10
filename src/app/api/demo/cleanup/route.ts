import { NextResponse } from "next/server";

import { cleanupDemoSessionAction } from "@/lib/demo/actions";

export async function POST() {
  await cleanupDemoSessionAction();
  return NextResponse.json({ ok: true });
}
