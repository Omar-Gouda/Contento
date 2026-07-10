import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CheckCircle2, Trash2, XCircle } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/constants/routes";
import {
  approveOrganizationRequestAction,
  archiveOrganizationRequestAction,
  deleteOrganizationRequestAction,
  rejectOrganizationRequestAction,
} from "@/lib/organization-requests/admin-actions";
import {
  getOrganizationRequests,
  isOrganizationRequestStatus,
  type OrganizationRequestRow,
} from "@/lib/organization-requests/queries";
import { formatCairoDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Organization Requests",
};

const statusLabels: Record<OrganizationRequestRow["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  ready_for_onboarding: "Ready for onboarding",
  rejected: "Rejected",
  archived: "Archived",
};

const filterTabs = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "ready_for_onboarding", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
] as const;

function statusVariant(status: OrganizationRequestRow["status"]) {
  if (status === "pending") {
    return "secondary" as const;
  }

  if (status === "rejected") {
    return "destructive" as const;
  }

  if (status === "archived") {
    return "outline" as const;
  }

  return "default" as const;
}

function RequestActions({ request }: { request: OrganizationRequestRow }) {
  const canApprove = request.status === "pending" || request.status === "rejected";
  const canReject = request.status === "pending" || request.status === "ready_for_onboarding" || request.status === "approved";
  const canArchive = request.status !== "archived";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <form action={approveOrganizationRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <Button type="submit" size="sm">
              <CheckCircle2 />
              Approve
            </Button>
          </form>
        )}
        {canArchive && (
          <form action={archiveOrganizationRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <Button type="submit" size="sm" variant="outline">
              <Archive />
              Archive
            </Button>
          </form>
        )}
        <form action={deleteOrganizationRequestAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <Button type="submit" size="sm" variant="destructive">
            <Trash2 />
            Delete
          </Button>
        </form>
      </div>
      {canReject && (
        <form action={rejectOrganizationRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="requestId" value={request.id} />
          <Input name="rejectionReason" placeholder="Rejection reason" />
          <Button type="submit" size="sm" variant="outline">
            <XCircle />
            Reject
          </Button>
        </form>
      )}
    </div>
  );
}

function RequestCard({ request }: { request: OrganizationRequestRow }) {
  return (
    <div className="grid gap-5 rounded-2xl border bg-secondary/25 p-4 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{request.organization_name}</h2>
          <Badge variant={statusVariant(request.status)}>{statusLabels[request.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {request.agency_name} · {request.owner_full_name} · {request.business_email}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Employees</span>
            {request.number_of_employees}
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested users</span>
            {request.expected_users}
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested clients</span>
            {request.expected_clients}
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Country</span>
            {request.city}, {request.country}
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Contract</span>
            {request.preferred_contract}
          </p>
          <p>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</span>
            {formatCairoDateTime(request.submitted_at)}
          </p>
        </div>
        <div className="mt-4 rounded-xl border bg-background/70 p-3 text-sm leading-6 text-muted-foreground">
          {request.additional_notes || "No additional notes."}
        </div>
        {request.rejection_reason && (
          <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            Rejection reason: {request.rejection_reason}
          </p>
        )}
        {request.approved_company_id && (
          <Link
            href={routes.superiorAdmin.organization(request.approved_company_id)}
            className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Open prepared organization
          </Link>
        )}
      </div>
      <RequestActions request={request} />
    </div>
  );
}

export default async function SuperAdminOrganizationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const selectedStatus = isOrganizationRequestStatus(params.status) ? params.status : "";
  const requests = await getOrganizationRequests(selectedStatus);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Super Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Organization Requests</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review public demo conversion requests and prepare onboarding-ready workspaces.
          </p>
        </div>
        <Link href={routes.superiorAdmin.organizations} className={buttonVariants({ variant: "outline" })}>
          All organizations
        </Link>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `${routes.superiorAdmin.organizationRequests}?status=${tab.value}` : routes.superiorAdmin.organizationRequests}
            className={cn(
              buttonVariants({ variant: selectedStatus === tab.value ? "default" : "outline", size: "sm" })
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>
            Payment, subscriptions, Stripe, Paymob, invoices, and automatic billing are marked Coming Soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
          {!requests.length && (
            <p className="rounded-xl border bg-secondary/30 p-4 text-sm text-muted-foreground">
              No organization requests match this view.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
