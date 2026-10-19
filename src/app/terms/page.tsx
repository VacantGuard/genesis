import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms and Conditions" };

export default function TermsPage() {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 bg-white px-6 py-20 text-sm leading-7 text-[#171a20]">
      <h1 className="font-heading text-4xl tracking-tight">Terms and Conditions</h1>
      <p>These are the Terms of Service for North Bowl.</p>
      <p>
        These terms cover pickup orders and menu texts from North Bowl. Placing an order does not
        sign you up for texts. Menu texts start only after you check the consent box on the order
        form.
      </p>
      <p>
        North Bowl sends about one to four texts a week when the weekly menu is published or a meal
        changes. Each text includes the business name and a link to the menu. Message and data rates
        may apply. Reply STOP to opt out or HELP for help.
      </p>
      <p>
        <Link href="/b/north-bowl#pos" className="underline">
          Back to the order form
        </Link>
      </p>
    </main>
  );
}
