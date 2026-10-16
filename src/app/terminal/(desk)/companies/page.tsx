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
import { deleteCompanyAction, saveCompanyAction } from "@/lib/actions";
import { currentBusiness } from "@/lib/current-business";
import { getCompany, listCompanies } from "@/lib/directory";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const editId = Number(query.edit);
  const editing = Number.isInteger(editId) && editId > 0 ? getCompany(business.id, editId) : null;
  const companies = listCompanies(business.id);

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Companies</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Office accounts and the contact who should receive a campaign text.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />

      <form action={saveCompanyAction} className="grid gap-3 rounded-xl border bg-card p-4">
        <p className="font-medium">{editing ? `Edit ${editing.name}` : "Add a company"}</p>
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Company</span>
            <Input name="name" defaultValue={editing?.name ?? ""} required className="h-10 bg-background" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Contact name</span>
            <Input
              name="contactName"
              defaultValue={editing?.contactName ?? ""}
              className="h-10 bg-background"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Contact phone</span>
            <Input name="phone" defaultValue={editing?.phone ?? ""} className="h-10 bg-background" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Contact email</span>
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
          <Button type="submit">{editing ? "Save company" : "Add company"}</Button>
          {editing ? (
            <Button type="button" variant="outline" render={<a href="/terminal/companies" />}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No companies yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="whitespace-normal">{company.name}</TableCell>
                <TableCell className="whitespace-normal">{company.contactName || "—"}</TableCell>
                <TableCell>{company.phone || "—"}</TableCell>
                <TableCell className="whitespace-normal">{company.email || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" render={<a href={`/terminal/companies?edit=${company.id}`} />}>
                      Edit
                    </Button>
                    <form action={deleteCompanyAction}>
                      <input type="hidden" name="id" value={company.id} />
                      <ConfirmButton message={`Remove ${company.name}?`}>Delete</ConfirmButton>
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
