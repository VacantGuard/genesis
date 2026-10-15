import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProfileAction } from "@/lib/actions";
import { getProfile } from "@/lib/db";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const profile = getProfile();

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Business</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The public page uses this name in the header and this copy in the About section.
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
    </>
  );
}
