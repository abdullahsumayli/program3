export type PlanId = "free" | "paid";

export type PlanConfig = {
  id: PlanId;
  name: string;
  monthlyMinutes: number;
  maxMembers: number;
  priceSAR: number;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    monthlyMinutes: 120,
    maxMembers: 1,
    priceSAR: 0,
  },
  paid: {
    id: "paid",
    name: "Paid",
    monthlyMinutes: 3000,
    maxMembers: 20,
    priceSAR: 99,
  },
};

export function getPlan(id: PlanId | string | null | undefined): PlanConfig {
  if (id === "paid") return PLANS.paid;
  return PLANS.free;
}
