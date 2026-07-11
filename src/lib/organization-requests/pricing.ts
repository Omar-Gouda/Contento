export const organizationRequestPlanCodes = ["starter", "growth", "business", "enterprise"] as const;
export type OrganizationRequestPlanCode = (typeof organizationRequestPlanCodes)[number];

export const organizationRequestDurationYears = [1, 5, 7] as const;
export type OrganizationRequestDurationYears = (typeof organizationRequestDurationYears)[number];

export type OrganizationRequestPlan = {
  code: OrganizationRequestPlanCode;
  name: string;
  userLimit: number | null;
  yearlyPriceEgp: number | null;
  description: string;
};

export const organizationRequestPlans: OrganizationRequestPlan[] = [
  {
    code: "starter",
    name: "Starter",
    userLimit: 10,
    yearlyPriceEgp: 12000,
    description: "For focused teams getting their first operating workspace live.",
  },
  {
    code: "growth",
    name: "Growth",
    userLimit: 30,
    yearlyPriceEgp: 18000,
    description: "For growing agencies managing more clients, creators, and approvals.",
  },
  {
    code: "business",
    name: "Business",
    userLimit: 75,
    yearlyPriceEgp: 30000,
    description: "For larger agency operations that need broader team coverage.",
  },
  {
    code: "enterprise",
    name: "Enterprise",
    userLimit: null,
    yearlyPriceEgp: null,
    description: "For custom onboarding, larger teams, and tailored commercial terms.",
  },
];

export const organizationRequestDurationOptions = [
  { years: 1, label: "1 year", discountLabel: "Base price", discount: 0 },
  { years: 5, label: "5 years", discountLabel: "20% discount", discount: 0.2 },
  { years: 7, label: "7 years", discountLabel: "30% discount", discount: 0.3 },
] as const;

export function isOrganizationRequestPlanCode(value: string): value is OrganizationRequestPlanCode {
  return organizationRequestPlanCodes.some((code) => code === value);
}

export function isOrganizationRequestDurationYears(value: number): value is OrganizationRequestDurationYears {
  return organizationRequestDurationYears.some((years) => years === value);
}

export function getOrganizationRequestPlan(code: OrganizationRequestPlanCode | string | null | undefined) {
  return organizationRequestPlans.find((plan) => plan.code === code) ?? organizationRequestPlans[0];
}

export function calculateOrganizationRequestAmount(
  planCode: OrganizationRequestPlanCode,
  durationYears: OrganizationRequestDurationYears
) {
  const plan = getOrganizationRequestPlan(planCode);

  if (plan.code === "enterprise" || plan.yearlyPriceEgp === null) {
    return null;
  }

  const duration = organizationRequestDurationOptions.find((item) => item.years === durationYears);
  const discount = duration?.discount ?? 0;

  return Math.round(plan.yearlyPriceEgp * durationYears * (1 - discount));
}

export function formatOrganizationRequestAmount(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return "Contact Sales";
  }

  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}
