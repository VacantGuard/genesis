import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { orderExportRows } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/terminal/login", request.url));
  }

  const rows = orderExportRows();
  const csv = toCsv(
    [
      "order_number",
      "customer_name",
      "company",
      "phone",
      "email",
      "delivery_address",
      "delivery_locate_url",
      "item",
      "quantity",
      "unit_price",
      "notes",
      "placed_at",
    ],
    rows.map((row) => [
      row.orderNumber,
      row.customerName,
      row.companyName,
      row.phone,
      row.email,
      row.deliveryAddress,
      row.deliveryLocateUrl,
      row.item,
      row.quantity,
      formatMoney(row.unitPriceCents),
      row.notes,
      row.placedAt,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"kitchen-orders.csv\"",
    },
  });
}
