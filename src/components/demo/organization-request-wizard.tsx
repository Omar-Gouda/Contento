"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";

import { submitOrganizationRequestAction } from "@/lib/organization-requests/actions";
import { initialOrganizationRequestState } from "@/lib/organization-requests/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Organization", description: "Tell us who will own the workspace." },
  { title: "Scale", description: "Help us understand your agency size." },
  { title: "Purchase", description: "Online purchase is coming soon." },
] as const;

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  children,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  children: ReactNode;
  defaultValue?: string;
}) {
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </select>
    </Field>
  );
}

export function OrganizationRequestWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [state, formAction, pending] = useActionState(
    submitOrganizationRequestAction,
    initialOrganizationRequestState
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  const completed = state.success;

  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-request-title"
        className="relative max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-3xl border bg-background shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close organization request"
          className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </button>

        <div className="grid max-h-[92dvh] overflow-y-auto lg:grid-cols-[0.9fr_1.4fr]">
          <aside className="bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.35),_transparent_34%),linear-gradient(135deg,_#0f0b1a,_#1a1626)] p-6 text-white sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3.5" />
              Contento growth request
            </span>
            <h2 id="organization-request-title" className="mt-6 max-w-sm text-3xl font-semibold tracking-normal">
              Build your own Contento workspace.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
              Submit a request after exploring the demo. A Super Admin can prepare your organization for onboarding while online purchase is being finalized.
            </p>
            <div className="mt-8 grid gap-3">
              {steps.map((item, index) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      index <= step || completed
                        ? "border-violet-300 bg-violet-500 text-white"
                        : "border-white/20 bg-white/5 text-white/60"
                    )}
                  >
                    {completed || index < step ? <CheckCircle2 className="size-4" /> : index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">{item.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </aside>

          <form action={formAction} className="p-6 sm:p-8">
            {completed ? (
              <div className="grid min-h-[26rem] place-items-center text-center">
                <div>
                  <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CheckCircle2 className="size-7" />
                  </span>
                  <h3 className="mt-5 text-2xl font-semibold">Request submitted</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    Your organization request is now pending Super Admin review. Online purchase and subscriptions are coming soon.
                  </p>
                  <Button type="button" className="mt-6" onClick={() => onOpenChange(false)}>
                    Got it
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className={cn("grid gap-5", step !== 0 && "hidden")}>
                  <div>
                    <p className="text-sm font-medium text-primary">Step 1 of 3</p>
                    <h3 className="mt-1 text-2xl font-semibold">Organization details</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      This request does not create a paid account. It gives the platform team enough context to prepare onboarding.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="organizationName" label="Organization name">
                      <Input id="organizationName" name="organizationName" autoComplete="organization" />
                    </Field>
                    <Field id="agencyName" label="Agency name">
                      <Input id="agencyName" name="agencyName" />
                    </Field>
                    <Field id="ownerFullName" label="Owner full name">
                      <Input id="ownerFullName" name="ownerFullName" autoComplete="name" />
                    </Field>
                    <Field id="businessEmail" label="Business email">
                      <Input id="businessEmail" name="businessEmail" type="email" autoComplete="email" />
                    </Field>
                    <Field id="phone" label="Phone number">
                      <Input id="phone" name="phone" autoComplete="tel" />
                    </Field>
                    <Field id="website" label="Website">
                      <Input id="website" name="website" placeholder="agency.com" />
                    </Field>
                  </div>
                </div>

                <div className={cn("grid gap-5", step !== 1 && "hidden")}>
                  <div>
                    <p className="text-sm font-medium text-primary">Step 2 of 3</p>
                    <h3 className="mt-1 text-2xl font-semibold">Agency scale</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The workspace will be sized around your expected team, client, and workflow needs.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="country" label="Country">
                      <Input id="country" name="country" autoComplete="country-name" />
                    </Field>
                    <Field id="city" label="City">
                      <Input id="city" name="city" autoComplete="address-level2" />
                    </Field>
                    <SelectField id="agencySize" name="agencySize" label="Agency size" defaultValue="2-10">
                      <option value="Solo">Solo</option>
                      <option value="2-10">2-10</option>
                      <option value="11-25">11-25</option>
                      <option value="26-50">26-50</option>
                      <option value="51-100">51-100</option>
                      <option value="100+">100+</option>
                    </SelectField>
                    <Field id="industry" label="Industry">
                      <Input id="industry" name="industry" placeholder="Marketing, media, creative..." />
                    </Field>
                    <Field id="numberOfEmployees" label="Number of employees">
                      <Input id="numberOfEmployees" name="numberOfEmployees" type="number" min="1" defaultValue="5" />
                    </Field>
                    <Field id="expectedUsers" label="Expected users">
                      <Input id="expectedUsers" name="expectedUsers" type="number" min="1" defaultValue="8" />
                    </Field>
                    <Field id="expectedClients" label="Expected clients">
                      <Input id="expectedClients" name="expectedClients" type="number" min="0" defaultValue="6" />
                    </Field>
                  </div>
                </div>

                <div className={cn("grid gap-5", step !== 2 && "hidden")}>
                  <div>
                    <p className="text-sm font-medium text-primary">Step 3 of 3</p>
                    <h3 className="mt-1 text-2xl font-semibold">Pricing & Online Purchase</h3>
                    <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-5">
                      <p className="text-lg font-semibold">Coming Soon</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        We are preparing online subscriptions. Our team will contact you shortly after reviewing your request.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField id="preferredContract" name="preferredContract" label="Preferred contract" defaultValue="monthly">
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </SelectField>
                    <SelectField
                      id="needsEnterprisePricing"
                      name="needsEnterprisePricing"
                      label="Need enterprise pricing?"
                      defaultValue="no"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </SelectField>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="additionalNotes">Additional notes</Label>
                      <textarea
                        id="additionalNotes"
                        name="additionalNotes"
                        rows={5}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder="Tell us about workflows, teams, approval needs, or launch timing."
                      />
                    </div>
                  </div>
                </div>

                {state.message && !state.success && (
                  <p className="mt-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                    {state.message}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => (step === 0 ? onOpenChange(false) : setStep((value) => value - 1))}>
                    {step === 0 ? "Cancel" : <><ChevronLeft /> Back</>}
                  </Button>
                  {step < 2 ? (
                    <Button type="button" onClick={() => setStep((value) => value + 1)}>
                      Continue
                      <ChevronRight />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={pending}>
                      {pending ? "Submitting..." : "Submit Request"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
