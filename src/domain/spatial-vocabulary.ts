/** Shared meanings prevent a mislabeled axis from manufacturing a library gap.
 * New values remain possible; known values cannot migrate between dimensions. */
export const spatialVocabulary = {
  terrain: [
    "land",
    "waterfront",
    "forest",
    "mountain",
    "highland",
    "barren",
    "salt-flat",
    "desert",
    "snowfield",
  ],
  settlement: ["urban", "rural", "wild", "none"],
  era: ["modern", "historical", "future"],
  activity: ["walking", "everyday", "overlook", "nightlife"],
  reality: ["real", "dream"],
} as const;
export function expectedSpatialAxis(value: string): string | undefined {
  return Object.entries(spatialVocabulary).find(([, values]) =>
    (values as readonly string[]).includes(value),
  )?.[0];
}
