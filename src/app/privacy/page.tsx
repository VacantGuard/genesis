import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TigEats Privacy Policy",
  description:
    "How TigEats uses phone numbers and text-message data for weekly menu updates and order reminders.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 bg-white px-6 py-20 text-sm leading-7 text-[#171a20]">
      <h1 className="font-heading text-4xl tracking-tight">Privacy Policy</h1>
      <p>
        This privacy policy is for <strong>TigEats</strong>, the brand that sends these text
        messages. It covers the TigEats SMS program and the information collected when you order.
      </p>
      <h2 className="font-heading text-2xl tracking-tight">SMS program</h2>
      <p>
        TigEats sends text messages only to people who opt in. Messages are weekly menu updates and
        order reminders for existing customers. You may receive about one to four messages per week.
        Message and data rates may apply.
      </p>
      <p>
        Consent to receive texts is not required to buy. You can place an order without checking the
        text-message box. Checking that box is how you opt in.
      </p>
      <p>
        Reply STOP to opt out of TigEats texts. Reply HELP for help. After you reply STOP, TigEats
        will not send you further marketing or reminder texts unless you opt in again.
      </p>
      <h2 className="font-heading text-2xl tracking-tight">Phone numbers and message data</h2>
      <p>
        If you opt in, TigEats collects your mobile phone number and stores your opt-in choice. TigEats
        also keeps message data related to that program: the text of messages sent to you, delivery
        status, and the time you opt in or reply STOP or HELP.
      </p>
      <p>TigEats uses your phone number and message data only to:</p>
      <ul className="list-disc pl-5">
        <li>Send the weekly menu updates and order reminders you requested.</li>
        <li>Confirm your opt-in and process STOP and HELP replies.</li>
        <li>Keep a record that you consented, and that you opted out if you reply STOP.</li>
        <li>Troubleshoot failed or undelivered messages for your number.</li>
      </ul>
      <p>
        TigEats does not use your phone number or message data to sell products to people who have not
        opted in, and does not use them for any program other than these menu updates and order
        reminders.
      </p>
      <p>
        When you place an order, TigEats also collects your name, email, optional company name,
        delivery address, optional prep notes, and, if you pay by card, the last four digits of that
        card. TigEats uses that order information to prepare and deliver the order and to send a
        receipt. Your phone number from an order is not added to the SMS program unless you check the
        optional consent box.
      </p>
      <h2 className="font-heading text-2xl tracking-tight">Sharing</h2>
      <p>
        TigEats does not sell or share your mobile phone number, SMS opt-in data, or message content
        with third parties or affiliates for their marketing. A texting provider (such as Twilio)
        processes messages on TigEats’s behalf solely to deliver the program. Carriers may also
        handle delivery of the texts.
      </p>
      <p>
        <Link href="/terms" className="underline">
          Terms and Conditions
        </Link>
        {" · "}
        <Link href="/b/tigeats#pos" className="underline">
          Order form
        </Link>
      </p>
    </main>
  );
}
