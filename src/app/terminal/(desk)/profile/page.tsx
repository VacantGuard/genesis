import { headers } from "next/headers";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProfileAction } from "@/lib/actions";
import { rememberedOrigin } from "@/lib/businesses";
import { currentBusiness } from "@/lib/current-business";
import { saveStripeAction, saveZelleAction } from "@/lib/business-actions";
import { stripeSettings } from "@/lib/stripe";
import { zelleDraft } from "@/lib/zelle";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const profile = await currentBusiness();
  const stripe = stripeSettings(profile.id);
  const zelle = zelleDraft(profile.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = headerStore.get("x-forwarded-proto") || (local ? "http" : "https");
  const origin = rememberedOrigin(profile.id) || (host ? `${proto}://${host}` : "");
  const webhookUrl = `${origin}/api/stripe/webhook`;

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Business</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The public page uses this name in the header and this copy in the About section. This
          business is at /b/{profile.slug}.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />
      <form action={saveProfileAction} className="grid max-w-2xl gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Business name</span>
          <Input name="name" defaultValue={profile.name} required className="h-10 bg-card" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">About</span>
          <Textarea name="about" defaultValue={profile.about} required className="min-h-56 bg-card" />
        </label>
        <div>
          <Button type="submit">Save profile</Button>
        </div>
      </form>

      <section className="grid max-w-2xl gap-3 border-t pt-6">
        <h2 className="font-heading text-2xl tracking-tight">Zelle</h2>
        <p className="text-sm text-muted-foreground">
          Customers who pay with Zelle send the order total to this name and email or mobile number.
          The order is not marked paid until someone on this desk confirms the transfer. Leave the
          email or phone blank to hide Zelle on the public menu.
        </p>
        <form action={saveZelleAction} className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name customers see</span>
            <Input
              name="name"
              defaultValue={zelle.name}
              placeholder={profile.name}
              className="h-10 bg-card"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Zelle email or mobile number</span>
            <Input
              name="handle"
              defaultValue={zelle.handle}
              placeholder="kitchen@tigeats.com"
              autoComplete="off"
              className="h-10 bg-card"
            />
          </label>
          <div>
            <Button type="submit">Save Zelle</Button>
          </div>
        </form>
      </section>

      <section className="grid max-w-2xl gap-3 border-t pt-6">
        <h2 className="font-heading text-2xl tracking-tight">Stripe</h2>
        <p className="text-sm text-muted-foreground">
          This is how {profile.name} takes Apple Pay and card payments. Customer checkout on the public
          menu charges through this Stripe account, then the paid order shows on Orders. Apple Pay
          shows when the customer’s browser can use it and the domain is registered in Stripe.
        </p>
        {stripe.connected ? (
          <p className="text-sm font-medium">Stripe is connected.</p>
        ) : (
          <div className="text-sm">
            <p>Stripe is not connected. Add these before a customer card can be charged:</p>
            <ul className="mt-2 list-disc pl-5">
              {stripe.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <form action={saveStripeAction} className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Publishable key</span>
            <Input
              name="publishableKey"
              defaultValue={stripe.publishableKey}
              placeholder="pk_live_ or pk_test_"
              autoComplete="off"
              className="h-10 bg-card"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Secret key</span>
            <Input
              name="secretKey"
              type="password"
              placeholder={stripe.hasSecret ? "Saved. Paste a new secret key to replace it." : "sk_live_ or sk_test_"}
              autoComplete="new-password"
              className="h-10 bg-card"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Webhook secret</span>
            <Input
              name="webhookSecret"
              type="password"
              placeholder={
                stripe.hasWebhookSecret ? "Saved. Paste a new webhook secret to replace it." : "whsec_"
              }
              autoComplete="new-password"
              className="h-10 bg-card"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            In Stripe, add an endpoint for {webhookUrl} and use the payment_intent.succeeded event. The
            secret from that endpoint is the webhook secret. Secret keys stay on this business and are
            not shown again.
          </p>
          <div>
            <Button type="submit">Save Stripe</Button>
          </div>
        </form>
        {stripe.connected ? (
          <form action={saveStripeAction}>
            <input type="hidden" name="intent" value="disconnect" />
            <Button type="submit" variant="outline">
              Disconnect Stripe
            </Button>
          </form>
        ) : null}
      </section>
    </>
  );
}
