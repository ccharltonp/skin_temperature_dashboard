import { NextResponse } from "next/server";
import { exportCsv } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = exportCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="skin_temp_estimates_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
