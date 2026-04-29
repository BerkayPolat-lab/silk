import { getAnalyticsOverview } from "@/lib/analytics/usage";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const overview = await getAnalyticsOverview();
    return NextResponse.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load analytics overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
