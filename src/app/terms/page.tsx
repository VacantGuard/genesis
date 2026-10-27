import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TigEats Terms and Conditions",
  description:
    "Terms for TigEats text messages: weekly menu updates and order reminders for people who opt in.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 bg-white px-6 py-20 text-sm leading-7 text-[#171a20]">
      <h1 className="font-heading text-4xl tracking-tight">Terms and Conditions</h1>
      <p>
        These terms are for <strong>TigEats</strong>. They cover TigEats orders and the TigEats SMS
        program.
      </p>
      <h2 className="font-heading text-2xl tracking-tight">SMS program</h2>
      <p>
        TigEats sends recurring text messages to people who opt in. The messages are weekly menu
        updates and order reminders. TigEats does not send these texts to people who have not opted
        in.
      </p>
      <p>
        Message frequency: about one to four messages per week, when the weekly menu is published or
        when an order reminder is due. Message and data rates may apply.
      </p>
      <p>
        Reply STOP to opt out. Reply HELP for help. Opting out stops future TigEats program texts.
      </p>
      <p>
        Consent is not required to buy. You can place an order without agreeing to texts. Agreement
        to receive texts is not a condition of purchase.
      </p>
      <p>
        Each program text identifies TigEats and includes a link to the menu or order page when the
        message is about the menu or an order.
      </p>
      <p>
        How TigEats uses phone numbers and message data is described in the{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p>
        <Link href="/b/tigeats#pos" className="underline">
          Order form
        </Link>
      </p>
    </main>
  );
}
