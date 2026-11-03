import { GO_LIVE_MESSAGE } from "@/lib/go-live";

export function LaunchAnticipation() {
  const [headline, detail] = GO_LIVE_MESSAGE.split("! ");
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">TigEats</p>
        <h1 className="font-heading mt-2 text-4xl tracking-tight">{headline}!</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      </main>
      <p className="pb-6 text-center text-xs text-[#5d7568]">
        <a href="https://www.avenixplatform.tech/" target="_blank" rel="noreferrer" className="hover:text-[#496252]">
          Created by Avenix
        </a>
      </p>
    </div>
  );
}
