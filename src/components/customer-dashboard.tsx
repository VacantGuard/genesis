"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatMoney, formatWhen } from "@/lib/format";
import type { PublicCategory } from "@/lib/types";
import type { CustomerOrder } from "@/lib/customer-auth";

export function CustomerDashboard({
  businessName,
  guest,
  clientNumber,
  accountLabel,
  menu,
  orders,
}: {
  businessName: string;
  guest: boolean;
  clientNumber: string;
  accountLabel: string;
  menu: PublicCategory[];
  orders: CustomerOrder[];
}) {
  const categories = menu.filter((category) => category.items.length > 0);
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const visible = categoryId === "all" ? categories : categories.filter((category) => category.id === categoryId);
  const meals = useMemo(
    () => categories.flatMap((category) => category.items),
    [categories],
  );
  const available = meals.filter((item) => item.available).length;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section id="menu">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[#5c5e62]">{businessName}</p>
            <h1 className="mt-1 text-4xl font-medium tracking-tight">This week</h1>
            <p className="mt-2 text-sm text-[#5c5e62]">
              {clientNumber ? `Client ${clientNumber}` : "Customer dashboard"}
              {guest ? ". Sign-in is temporarily skipped." : accountLabel ? ` · ${accountLabel}` : ""}
            </p>
          </div>
          <p className="text-sm text-[#5c5e62]">
            {available} available
            {meals.length - available > 0 ? ` · ${meals.length - available} sold out` : ""}
          </p>
        </div>

        {categories.length === 0 ? (
          <p className="mt-10 text-sm text-[#5c5e62]">
            The weekly menu is empty. Meals added in the staff terminal show up here.
          </p>
        ) : (
          <>
            <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
              <CategoryChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
                All
              </CategoryChip>
              {categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  active={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </CategoryChip>
              ))}
            </div>

            <div className="mt-8 grid gap-10">
              {visible.map((category) => (
                <div key={category.id}>
                  <h2 className="text-sm tracking-[0.16em] text-[#5c5e62] uppercase">{category.name}</h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {category.items.map((item) => (
                      <li
                        key={item.id}
                        className={`flex min-h-52 flex-col bg-white p-6 ${item.available ? "" : "opacity-60"}`}
                      >
                        <h3 className="text-2xl font-medium tracking-tight">{item.name}</h3>
                        <p className="mt-3 flex-1 text-sm leading-6 text-[#5c5e62]">{item.description}</p>
                        <div className="mt-6 flex items-center justify-between gap-3">
                          <p className="text-lg">{formatMoney(item.priceCents)}</p>
                          <p className="text-xs tracking-wide text-[#5c5e62] uppercase">
                            {item.available ? "Available" : "Sold out"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}

        <Link
          href="/#pos"
          className="mt-8 inline-flex h-10 items-center rounded bg-[#171a20] px-5 text-sm font-medium text-white"
        >
          Order from this menu
        </Link>
      </section>

      <aside id="orders" className="lg:pt-16">
        <h2 className="text-2xl font-medium tracking-tight">Your orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-[#5c5e62]">
            No paid orders yet for this phone number. An order shows here after checkout.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.map((order) => (
              <li key={order.orderNumber} className="bg-white p-4 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{order.orderNumber}</span>
                  <span>{formatMoney(order.totalCents)}</span>
                </div>
                <p className="mt-2 text-[#5c5e62]">{formatWhen(order.createdAt)}</p>
                {order.items ? <p className="mt-2 leading-6">{order.items}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded px-4 text-sm ${
        active ? "bg-[#171a20] text-white" : "bg-white text-[#171a20]"
      }`}
    >
      {children}
    </button>
  );
}
