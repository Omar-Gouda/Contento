import { getSuperAdminBillingOverview } from "@/lib/billing/queries";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const overview = await getSuperAdminBillingOverview();
  const rows = [
    ["company", "plan", "status", "amount_egp", "duration_years", "submitted_by", "created_at", "reviewed_at", "rejection_reason"],
    ...overview.receipts.map((receipt) => [
      receipt.companyName,
      receipt.planName ?? "",
      receipt.status,
      receipt.amount_egp,
      receipt.duration_years,
      receipt.submittedByEmail ?? "",
      receipt.created_at,
      receipt.reviewed_at ?? "",
      receipt.rejection_reason ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="contento-billing-receipts.csv"`,
    },
  });
}
