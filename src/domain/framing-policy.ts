/** Reusable camera language. Occupancy is a geometric production requirement,
 * not a promise of artistic quality; overhead keeps the shared spatial context. */
export const framingPolicy = {
  intimate: { firstFov: 50, minimumSpan: 0.5, crop: "coverage" },
  hero: { firstFov: 54, minimumSpan: 0.35, crop: "contain" },
  vista: { firstFov: 66, minimumSpan: 0.18, crop: "contain" },
} as const;
