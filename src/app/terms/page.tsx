import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TigEats Terms and Conditions",
  description:
    "Terms for TigEats orders and text messages: weekly menu updates and order reminders for people who opt in.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 bg-white px-6 py-20 text-sm leading-7 text-[#171a20]">
      <h1 className="font-heading text-4xl tracking-tight">Terms and Conditions</h1>
      <p>Effective October 27, 2026.</p>
      <p>
        These terms are the agreement between you and <strong>TigEats</strong> for ordering meals and,
        if you opt in, for the TigEats text program. If you do not agree, do not place an order and do
        not opt in to texts.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Who TigEats is</h2>
      <p>
        TigEats prepares portioned meals and sells them through this site. TigEats is the business named
        on the order page and on each text.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Who can order</h2>
      <p>
        You may order if you are at least 18 and you give a name, phone number, email, and delivery
        address that are yours. You are responsible for what is submitted from your account.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Your account</h2>
      <p>
        An account holds your name, phone, email, and the paid orders matched to that phone or email.
        Keep the password to yourself. Tell the kitchen if you think someone else is using the account.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Text messages</h2>
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
        message is about the menu or an order. Carriers may delay or drop a text. TigEats does not
        promise that every handset will show it.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Orders</h2>
      <p>
        An order is the meals you choose on the order page, plus the delivery address and any
        alteration note you write on a meal. TigEats confirms a paid order on the site. A note is a
        request for that meal. The kitchen follows it when it can. A note is not a promise that a
        meal is free of an ingredient.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Payment</h2>
      <p>
        Card payments run through Stripe for the business connected on this desk. The price is the
        total shown before you pay. TigEats stores the last four digits of the card with the order,
        not the full card number. If a charge does not go through, the order is not marked paid.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Delivery</h2>
      <p>
        Meals go to the address on the order. You should be able to receive them there and put them
        in a refrigerator when they arrive. TigEats does not publish a guaranteed arrival window on
        this page.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Food</h2>
      <p>
        Follow the heating directions that come with the meal. If you have an allergy, write it in
        the alteration note and decide whether the meal is right for you. TigEats meals are prepared
        in a kitchen that handles common allergens.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Problems with an order</h2>
      <p>
        If a paid order is wrong or a meal arrives in bad condition, contact the kitchen with the
        order number. TigEats may replace that meal or refund that part of the order. Say so soon
        after delivery, while the meal can still be checked.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">The site</h2>
      <p>
        The TigEats name, menu text, and pages belong to TigEats. You may use the site to read the
        menu, place an order, and manage your account. Do not copy the site or use it to place orders
        you do not intend to pay for.
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Privacy</h2>
      <p>
        How TigEats uses phone numbers and message data is described in the{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="font-heading text-2xl tracking-tight">Changes</h2>
      <p>
        TigEats can update these terms by posting a new version on this page and changing the date at
        the top. The version on this page is the one that applies to a new order or a new opt-in.
      </p>

      <p>
        <Link href="/b/tigeats#pos" className="underline">
          Order form
        </Link>
      </p>
    </main>
  );
}
