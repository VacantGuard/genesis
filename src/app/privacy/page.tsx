import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 py-12 text-sm leading-6">
      <h1 className="font-heading text-4xl tracking-tight">Privacy Policy</h1>
      <p>This policy is for North Bowl, the brand registered for these text messages.</p>
      <p>
        When you place a pickup order, North Bowl collects your name, mobile number, email, optional
        company name, optional prep notes, and the last four digits of the card used for the practice
        payment. North Bowl uses that information to prepare the order, send a receipt, and, only if
        you check the menu-text box, send the weekly menu and menu updates you asked for.
      </p>
      <p>You may receive up to 4 messages per week. Message and data rates may apply.</p>
      <p>You can reply STOP to opt out or HELP for help.</p>
      <p>We will not share your mobile numbers with third parties.</p>
      <p>
        We do not sell or share your SMS opt-in data or personal information with third parties for
        marketing purposes.
      </p>
      <p>
        <Link href="/b/north-bowl#pos" className="underline">
          Back to the order form
        </Link>
      </p>
    </main>
  );
}
