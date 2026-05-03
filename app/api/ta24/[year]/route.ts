import { NextResponse } from "next/server";
import { exportTa24Csv } from "@/server/tax";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year } = await params;
  const taxYear = Number(year);
  if (!Number.isInteger(taxYear) || taxYear < 2020 || taxYear > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }
  const { filename, csv } = await exportTa24Csv(taxYear);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
