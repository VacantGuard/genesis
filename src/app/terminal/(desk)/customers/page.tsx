import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteCustomerAction, saveCustomerAction } from "@/lib/actions";
import { currentBusiness } from "@/lib/current-business";
import { getCustomer, listCompanies, listCustomers } from "@/lib/directory";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const editId = Number(query.edit);
  const editing = Number.isInteger(editId) && editId > 0 ? getCustomer(business.id, editId) : null;
  const customers = listCustomers(business.id);
  const companies = listCompanies(business.id);

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Customers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          People you can include in a text campaign. A customer can belong to a company.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />

      <form action={saveCustomerAction} className="grid gap-3 rounded-xl border bg-card p-4">
        <p className="font-medium">{editing ? `Edit ${editing.name}` : "Add a customer"}</p>
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input name="name" defaultValue={editing?.name ?? ""} required className="h-10 bg-background" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Company</span>
            <select
              name="companyId"
              defaultValue={editing?.companyId ?? ""}
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">No company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Phone</span>
            <Input name="phone" defaultValue={editing?.phone ?? ""} className="h-10 bg-background" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <Input
              name="email"
              type="email"
              defaultValue={editing?.email ?? ""}
              className="h-10 bg-background"
            />
          </label>
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-medium">Notes</span>
            <Textarea name="notes" defaultValue={editing?.notes ?? ""} className="min-h-20 bg-background" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{editing ? "Save customer" : "Add customer"}</Button>
          {editing ? (
            <Button type="button" variant="outline" nativeButton={false} render={<a href="/terminal/customers" />}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customers yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="whitespace-normal">{customer.name}</TableCell>
                <TableCell>{customer.phone || "—"}</TableCell>
                <TableCell className="whitespace-normal">{customer.email || "—"}</TableCell>
                <TableCell className="whitespace-normal">{customer.companyName || "—"}</TableCell>
                <TableCell className="max-w-xs whitespace-normal">{customer.notes || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/terminal/customers?edit=${customer.id}`} />}>
                      Edit
                    </Button>
                    <form action={deleteCustomerAction}>
                      <input type="hidden" name="id" value={customer.id} />
                      <ConfirmButton message={`Remove ${customer.name}?`}>Delete</ConfirmButton>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
