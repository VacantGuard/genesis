import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCategoryAction,
  createMenuItemAction,
  deleteCategoryAction,
  deleteMenuItemAction,
  renameCategoryAction,
  setAvailabilityAction,
  updateMenuItemAction,
} from "@/lib/actions";
import { currentBusiness } from "@/lib/current-business";
import { formatMoney } from "@/lib/format";
import { listCategories, listMenuItems } from "@/lib/menu";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const categories = listCategories(business.id);
  const items = listMenuItems(business.id);

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Weekly menu</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A save updates the public menu and tells the Slack agent, through n8n, to send clients the new link.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />

      <form action={createCategoryAction} className="flex flex-col gap-2 sm:flex-row">
        <Input name="name" placeholder="New category" required className="h-10 bg-card sm:max-w-xs" />
        <Button type="submit">Add category</Button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a category before you add meals.</p>
      ) : null}

      {categories.map((category) => {
        const meals = items.filter((item) => item.categoryId === category.id);
        return (
          <section key={category.id} className="grid gap-4 rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <form action={renameCategoryAction} className="flex flex-1 flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={category.id} />
                <Input name="name" defaultValue={category.name} required className="h-10 bg-background" />
                <Button type="submit" variant="outline">
                  Rename
                </Button>
              </form>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <ConfirmButton message={`Remove ${category.name} and every meal in it?`}>
                  Delete category
                </ConfirmButton>
              </form>
            </div>

            {meals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meals in this category yet.</p>
            ) : (
              <div className="grid gap-4">
                {meals.map((item) => (
                  <div key={item.id} className="grid gap-3 border-t pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.name}</p>
                      <span className="text-sm text-muted-foreground">{formatMoney(item.priceCents)}</span>
                      {item.available ? <Badge>Available</Badge> : <Badge variant="outline">Sold out</Badge>}
                    </div>
                    <form action={updateMenuItemAction} className="grid gap-3">
                      <input type="hidden" name="id" value={item.id} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1.5 text-sm">
                          <span className="font-medium">Name</span>
                          <Input name="name" defaultValue={item.name} required className="h-10 bg-background" />
                        </label>
                        <label className="grid gap-1.5 text-sm">
                          <span className="font-medium">Category</span>
                          <select
                            name="categoryId"
                            defaultValue={item.categoryId}
                            className="h-10 rounded-lg border bg-background px-3 text-sm"
                          >
                            {categories.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
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
                        <label className="flex items-center gap-2 self-end text-sm">
                          <input type="hidden" name="available" value="0" />
                          <input
                            type="checkbox"
                            name="available"
                            value="1"
                            defaultChecked={item.available}
                          />
                          Available on the public menu
                        </label>
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
                  </div>
                ))}
              </div>
            )}

            <form action={createMenuItemAction} className="grid gap-3 border-t pt-4">
              <p className="text-sm font-medium">Add a meal to {category.name}</p>
              <input type="hidden" name="categoryId" value={category.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input name="name" placeholder="Meal name" required className="h-10 bg-background" />
                <Input
                  name="price"
                  placeholder="Price, e.g. 12.00"
                  inputMode="decimal"
                  required
                  className="h-10 bg-background"
                />
                <Textarea
                  name="description"
                  placeholder="Short description"
                  className="min-h-20 bg-background md:col-span-2"
                />
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
          </section>
        );
      })}
    </>
  );
}
