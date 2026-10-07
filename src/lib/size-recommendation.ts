export type RecommendedSize = "S" | "M" | "L" | "XL" | "XXL";

/**
 * Placeholder height/weight size formula from the Mirox Product.dc.html
 * reference — thresholds are the design demo's, NOT real garment size charts
 * (TASK-045 replaces this with a real,
 * chart-driven assistant). Kept as a pure function so the AC's exact bands
 * stay unit-tested.
 */
export function recommendSize(heightCm: number, weightKg: number): RecommendedSize {
  if (heightCm >= 190 || weightKg >= 95) return "XXL";
  if (heightCm >= 184 || weightKg >= 85) return "XL";
  if (heightCm >= 176 || weightKg >= 72) return "L";
  if (heightCm >= 168 || weightKg >= 60) return "M";
  return "S";
}
