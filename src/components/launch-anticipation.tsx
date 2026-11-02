import { GO_LIVE_MESSAGE } from "@/lib/go-live";

export function LaunchAnticipation() {
  const [headline, detail] = GO_LIVE_MESSAGE.split("! ");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">TigEats</p>
      <h1 className="font-heading mt-2 text-4xl tracking-tight">{headline}!</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
    </main>
  );
}
