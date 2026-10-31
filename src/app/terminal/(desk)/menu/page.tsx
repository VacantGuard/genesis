import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createMenuItemAction,
  deleteMenuItemAction,
  saveMenuWeekAction,
  setAvailabilityAction,
  updateMenuItemAction,
} from "@/lib/actions";
import { getMenuWeekNote } from "@/lib/businesses";
import { currentBusiness } from "@/lib/current-business";
import { formatMoney } from "@/lib/format";
import { mealPhotoUrl } from "@/lib/meal-photo";
import { listMenuItems } from "@/lib/menu";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const items = listMenuItems(business.id);
  const weekNote = getMenuWeekNote(business.id);

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Weekly menu</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A save updates the public menu and tells the Slack agent, through n8n, to send clients the new link.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />

      <form action={saveMenuWeekAction} className="grid gap-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-medium">Week of</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in parentheses under “menu of the week” on the public menu.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            name="weekOf"
            defaultValue={weekNote}
            placeholder="10/19 and 10/22 deliveries"
            maxLength={80}
            className="h-10 bg-background sm:max-w-md"
          />
          <Button type="submit">Save week</Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meals on the menu yet.</p>
      ) : (
        <div className="grid gap-6">
          {items.map((item) => {
            const photo = mealPhotoUrl(item.id, item.photoUpdatedAt);
            return (
              <section key={item.id} className="grid gap-4 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                  <h2 className="font-heading text-xl">{item.name}</h2>
                  <span className="text-sm text-muted-foreground">{formatMoney(item.priceCents)}</span>
                  {item.available ? <Badge>Available</Badge> : <Badge variant="outline">Sold out</Badge>}
                </div>
                <form action={updateMenuItemAction} className="grid gap-3">
                  <input type="hidden" name="id" value={item.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1.5 text-sm md:col-span-2">
                      <span className="font-medium">Name</span>
                      <Input name="name" defaultValue={item.name} required className="h-10 bg-background" />
                    </label>
                    <label className="grid gap-1.5 text-sm md:col-span-2">
                      <span className="font-medium">Description</span>
                      <Textarea
                        name="description"
                        defaultValue={item.description}
                        className="min-h-20 bg-background"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Price (USD)</span>
                      <Input
                        name="price"
                        defaultValue={(item.priceCents / 100).toFixed(2)}
                        inputMode="decimal"
                        required
                        className="h-10 bg-background"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Calories</span>
                      <Input
                        name="calories"
                        type="number"
                        min={0}
                        max={9999}
                        step={1}
                        inputMode="numeric"
                        defaultValue={item.calories ?? ""}
                        placeholder="625"
                        className="h-10 bg-background"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Protein (g)</span>
                      <Input
                        name="protein"
                        type="number"
                        min={0}
                        max={999}
                        step={1}
                        inputMode="numeric"
                        defaultValue={item.protein ?? ""}
                        placeholder="45"
                        className="h-10 bg-background"
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end text-sm">
                      <input type="hidden" name="available" value="0" />
                      <input type="checkbox" name="available" value="1" defaultChecked={item.available} />
                      Available on the public menu
                    </label>
                    <label className="grid gap-1.5 text-sm md:col-span-2">
                      <span className="font-medium">Photo</span>
                      {photo ? (
                        <img src={photo} alt="" className="h-36 w-full max-w-xs rounded-lg object-cover" />
                      ) : (
                        <span className="text-muted-foreground">No photo yet. It shows above this meal on the public menu.</span>
                      )}
                      <input
                        name="photo"
                        type="file"
                        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                        className="text-sm"
                      />
                    </label>
                    {photo ? (
                      <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <input type="checkbox" name="removePhoto" value="1" />
                        Remove photo
                      </label>
                    ) : null}
                  </div>
                  <div>
                    <Button type="submit">Save meal</Button>
                  </div>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action={setAvailabilityAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="available" value={item.available ? "0" : "1"} />
                    <Button type="submit" variant="outline" size="sm">
                      {item.available ? "Mark sold out" : "Mark available"}
                    </Button>
                  </form>
                  <form action={deleteMenuItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmButton message={`Remove ${item.name} from the menu?`}>Delete</ConfirmButton>
                  </form>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <form action={createMenuItemAction} className="grid gap-3 rounded-xl border bg-card p-4">
        <h2 className="font-heading text-xl">Add a meal</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="name" placeholder="Meal name" required className="h-10 bg-background" />
            <Input
              name="price"
              placeholder="Price, e.g. 12.00"
              inputMode="decimal"
              required
              className="h-10 bg-background"
            />
            <Input
              name="calories"
              type="number"
              min={0}
              max={9999}
              step={1}
              inputMode="numeric"
              placeholder="Calories, e.g. 625"
              className="h-10 bg-background"
            />
            <Input
              name="protein"
              type="number"
              min={0}
              max={999}
              step={1}
              inputMode="numeric"
              placeholder="Protein grams, e.g. 45"
              className="h-10 bg-background"
            />
            <Textarea
              name="description"
              placeholder="Short description"
              className="min-h-20 bg-background md:col-span-2"
            />
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">Photo</span>
              <input name="photo" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="text-sm" />
              <span className="text-xs text-muted-foreground">Optional jpg or png, up to 4 MB. Shown above the meal.</span>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="available" value="0" />
            <input type="checkbox" name="available" value="1" defaultChecked />
            Available
          </label>
          <div>
            <Button type="submit" variant="secondary">
              Add meal
            </Button>
          </div>
        </form>
    </>
  );
}
