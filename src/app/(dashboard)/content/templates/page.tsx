import type { Metadata } from "next";
import { Archive, FileText, Plus, Save } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { createContentTemplateAction, updateContentTemplateAction, archiveContentTemplateAction } from "@/lib/content-templates/actions";
import { getContentTemplates } from "@/lib/content-templates/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Content templates",
};

export default async function ContentTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("content.templates.use", "view");
  const templates = await getContentTemplates(context);
  const canManage = hasPermission(context, "content.templates.manage", "limited");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Content</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Content templates</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Maintain reusable content structures for consistent creator submissions.
        </p>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create template</CardTitle>
            <CardDescription>Active templates are available when creating content items.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createContentTemplateAction} className="grid gap-4 lg:grid-cols-3">
              <input type="hidden" name="redirectTo" value="/content/templates" />
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="body">Template body</Label>
                <Input id="body" name="body" />
              </div>
              <div className="lg:col-span-3">
                <Button type="submit">
                  <Plus />
                  Create template
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    {template.title}
                  </CardTitle>
                  <CardDescription>{template.description || "No description provided."}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={template.status === "active" ? "default" : "secondary"}>{template.status}</Badge>
                  {template.category && <Badge variant="outline">{template.category}</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {template.body && (
                <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
                  {template.body}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Updated {formatCairoDateTime(template.updated_at)} by {template.creatorName ?? "Unknown"}
              </p>
              {canManage && (
                <form action={updateContentTemplateAction} className="grid gap-3 rounded-lg border bg-secondary/30 p-3 lg:grid-cols-3">
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="redirectTo" value="/content/templates" />
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor={`title-${template.id}`}>Title</Label>
                    <Input id={`title-${template.id}`} name="title" defaultValue={template.title} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`category-${template.id}`}>Category</Label>
                    <Input id={`category-${template.id}`} name="category" defaultValue={template.category} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`description-${template.id}`}>Description</Label>
                    <Input id={`description-${template.id}`} name="description" defaultValue={template.description} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`body-${template.id}`}>Body</Label>
                    <Input id={`body-${template.id}`} name="body" defaultValue={template.body} />
                  </div>
                  <div className="lg:col-span-3">
                    <Button type="submit" variant="outline">
                      <Save />
                      Save
                    </Button>
                  </div>
                </form>
              )}
              {canManage && template.status === "active" && (
                <form action={archiveContentTemplateAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="redirectTo" value="/content/templates" />
                  <Button type="submit" variant="secondary">
                    <Archive />
                    Archive
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
        {!templates.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No content templates exist yet.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
