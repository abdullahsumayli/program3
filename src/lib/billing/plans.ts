export type PlanId = "free" | "basic" | "pro" | "enterprise";

export type PlanConfig = {
  id: PlanId;
  name: string;
  monthlyMinutes: number;
  monthlyMeetings: number;
  maxMembers: number;
  priceSAR: number;
  unlimited: boolean;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    monthlyMinutes: 120,
    monthlyMeetings: 3,
    maxMembers: 1,
    priceSAR: 0,
    unlimited: false,
  },
  basic: {
    id: "basic",
    name: "Basic",
    monthlyMinutes: 300,
    monthlyMeetings: 10,
    maxMembers: 5,
    priceSAR: 99,
    unlimited: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyMinutes: 2000,
    monthlyMeetings: 50,
    maxMembers: 20,
    priceSAR: 299,
    unlimited: false,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyMinutes: 999999,
    monthlyMeetings: 999999,
    maxMembers: 100,
    priceSAR: 799,
    unlimited: true,
  },
};

export const PAID_PLANS: PlanId[] = ["basic", "pro", "enterprise"];

export function getPlan(id: PlanId | string | null | undefined): PlanConfig {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS.free;
}

export function isPaidPlan(id: PlanId | string | null | undefined): boolean {
  return id === "basic" || id === "pro" || id === "enterprise";
}
