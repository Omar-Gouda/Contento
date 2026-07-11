"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";

import { submitOrganizationRequestAction } from "@/lib/organization-requests/actions";
import { initialOrganizationRequestState } from "@/lib/organization-requests/state";
import {
  calculateOrganizationRequestAmount,
  formatOrganizationRequestAmount,
  organizationRequestDurationOptions,
  organizationRequestPlans,
  type OrganizationRequestDurationYears,
  type OrganizationRequestPlanCode,
} from "@/lib/organization-requests/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Organization", description: "Workspace identity and operating location." },
  { title: "Owner", description: "The Marketing Manager who will own onboarding." },
  { title: "Plan", description: "Choose the workspace size that fits best." },
  { title: "Duration", description: "Select the billing term for launch planning." },
  { title: "Review", description: "Submit for Super Admin review." },
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
  const [planCode, setPlanCode] = useState<OrganizationRequestPlanCode>("starter");
  const [durationYears, setDurationYears] = useState<OrganizationRequestDurationYears>(1);
  const [state, formAction, pending] = useActionState(
    submitOrganizationRequestAction,
    initialOrganizationRequestState
  );
  const selectedPlan = useMemo(
    () => organizationRequestPlans.find((plan) => plan.code === planCode) ?? organizationRequestPlans[0],
    [planCode]
  );
  const calculatedAmount = calculateOrganizationRequestAmount(planCode, durationYears);
  const completed = state.success;

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

  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center bg-background/80 p-4 backdrop-blur-md"
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
        className="relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-3xl border bg-background text-foreground shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close organization request"
          className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </button>

        <div className="grid max-h-[92dvh] overflow-y-auto lg:grid-cols-[0.85fr_1.45fr]">
          <aside className="border-b bg-card p-6 text-card-foreground sm:p-8 lg:border-b-0 lg:border-r">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Contento growth request
            </span>
            <h2 id="organization-request-title" className="mt-6 max-w-sm text-3xl font-semibold tracking-normal">
              Build your own Contento workspace.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Pick a launch plan after exploring the demo. Online purchase is coming soon, so our team will contact you before any payment starts.
            </p>
            <div className="mt-8 grid gap-3">
              {steps.map((item, index) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      index <= step || completed
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {completed || index < step ? <CheckCircle2 className="size-4" /> : index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </aside>

          <form action={formAction} className="p-6 sm:p-8">
            <input type="hidden" name="planCode" value={planCode} />
            <input type="hidden" name="durationYears" value={durationYears} />
            <input type="hidden" name="calculatedAmountEgp" value={calculatedAmount ?? 0} />
            <input type="hidden" name="preferredContract" value="yearly" />
            <input type="hidden" name="needsEnterprisePricing" value={planCode === "enterprise" ? "yes" : "no"} />

            {completed ? (
              <div className="grid min-h-[26rem] place-items-center text-center">
                <div>
                  <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CheckCircle2 className="size-7" />
                  </span>
                  <h3 className="mt-5 text-2xl font-semibold">Request submitted</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    Your organization request is pending Super Admin review. Pricing & online purchase are coming soon; our team will contact you.
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
                    <p className="text-sm font-medium text-primary">Step 1 of 5</p>
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
                    <Field id="website" label="Website">
                      <Input id="website" name="website" placeholder="agency.com" />
                    </Field>
                    <Field id="industry" label="Industry">
                      <Input id="industry" name="industry" placeholder="Marketing, media, creative..." />
                    </Field>
                    <Field id="country" label="Country">
                      <Input id="country" name="country" autoComplete="country-name" />
                    </Field>
                    <Field id="city" label="City">
                      <Input id="city" name="city" autoComplete="address-level2" />
                    </Field>
                  </div>
                </div>

                <div className={cn("grid gap-5", step !== 1 && "hidden")}>
                  <div>
                    <p className="text-sm font-medium text-primary">Step 2 of 5</p>
                    <h3 className="mt-1 text-2xl font-semibold">Owner and scale</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The owner will become the first Marketing Manager and must change the temporary password on first sign-in.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="ownerFullName" label="Owner full name">
                      <Input id="ownerFullName" name="ownerFullName" autoComplete="name" />
                    </Field>
                    <Field id="businessEmail" label="Business email">
                      <Input id="businessEmail" name="businessEmail" type="email" autoComplete="email" />
                    </Field>
                    <Field id="phone" label="Phone number">
                      <Input id="phone" name="phone" autoComplete="tel" />
                    </Field>
                    <SelectField id="agencySize" name="agencySize" label="Agency size" defaultValue="2-10">
                      <option value="Solo">Solo</option>
                      <option value="2-10">2-10</option>
                      <option value="11-25">11-25</option>
                      <option value="26-50">26-50</option>
                      <option value="51-100">51-100</option>
                      <option value="100+">100+</option>
                    </SelectField>
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
                    <p className="text-sm font-medium text-primary">Step 3 of 5</p>
                    <h3 className="mt-1 text-2xl font-semibold">Plan selection</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Select the launch plan you want the Super Admin team to prepare.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {organizationRequestPlans.map((plan) => {
                      const active = plan.code === planCode;

                      return (
                        <button
                          key={plan.code}
                          type="button"
                          className={cn(
                            "rounded-2xl border bg-card p-4 text-left text-card-foreground transition hover:border-primary/60 hover:bg-primary/5",
                            active && "border-primary bg-primary/10 ring-2 ring-primary/20"
                          )}
                          onClick={() => setPlanCode(plan.code)}
                          aria-pressed={active}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{plan.name}</span>
                            {active && <CheckCircle2 className="size-5 text-primary" />}
                          </span>
                          <span className="mt-2 block text-sm text-muted-foreground">{plan.description}</span>
                          <span className="mt-4 block text-sm font-medium">
                            {plan.userLimit ? `Up to ${plan.userLimit} users` : "Custom users"}
                          </span>
                          <span className="mt-1 block text-lg font-semibold">
                            {plan.yearlyPriceEgp === null ? "Contact Sales" : formatOrganizationRequestAmount(plan.yearlyPriceEgp)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={cn("grid gap-5", step !== 3 && "hidden")}>
                  <div>
                    <p className="text-sm font-medium text-primary">Step 4 of 5</p>
                    <h3 className="mt-1 text-2xl font-semibold">Duration selection</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Longer durations unlock launch discounts. Enterprise requests use custom terms.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {organizationRequestDurationOptions.map((duration) => {
                      const active = duration.years === durationYears;

                      return (
                        <button
                          key={duration.years}
                          type="button"
                          className={cn(
                            "rounded-2xl border bg-card p-4 text-left text-card-foreground transition hover:border-primary/60 hover:bg-primary/5",
                            active && "border-primary bg-primary/10 ring-2 ring-primary/20"
                          )}
                          onClick={() => setDurationYears(duration.years)}
                          aria-pressed={active}
                        >
                          <span className="font-semibold">{duration.label}</span>
                          <span className="mt-2 block text-sm text-muted-foreground">{duration.discountLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5">
                    <p className="text-sm font-medium text-primary">Calculated total</p>
                    <p className="mt-1 text-3xl font-semibold">
                      {formatOrganizationRequestAmount(calculatedAmount)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedPlan.code === "enterprise"
                        ? "Enterprise pricing is custom. Our team will contact you."
                        : `${selectedPlan.name} for ${durationYears} year${durationYears === 1 ? "" : "s"}, before any taxes or custom onboarding fees.`}
                    </p>
                  </div>
                </div>

                <div className={cn("grid gap-5", step !== 4 && "hidden")}>
                  <div>
                    <p className="text-sm font-medium text-primary">Step 5 of 5</p>
                    <h3 className="mt-1 text-2xl font-semibold">Review and submit</h3>
                    <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-5">
                      <p className="text-lg font-semibold">Pricing & online purchase are coming soon.</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Our team will contact you after review. No money is charged from this demo request.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-2xl border bg-card p-4 text-sm text-card-foreground sm:grid-cols-3">
                    <p>
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan</span>
                      {selectedPlan.name}
                    </p>
                    <p>
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Duration</span>
                      {durationYears} year{durationYears === 1 ? "" : "s"}
                    </p>
                    <p>
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</span>
                      {formatOrganizationRequestAmount(calculatedAmount)}
                    </p>
                  </div>
                  <div className="space-y-2">
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

                {state.message && !state.success && (
                  <p className="mt-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                    {state.message}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (step === 0 ? onOpenChange(false) : setStep((value) => value - 1))}
                  >
                    {step === 0 ? "Cancel" : <><ChevronLeft /> Back</>}
                  </Button>
                  {step < steps.length - 1 ? (
                    <Button type="button" onClick={() => setStep((value) => value + 1)}>
                      Continue
                      <ChevronRight />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={pending}>
                      {pending ? "Submitting..." : "Submit request"}
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
