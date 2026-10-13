import {
  canonical,
  entryIdentity,
  type LibraryEntry,
  type CreativeLibrary,
} from "./creative-library";

const rounded = (n: number, step: number) => Math.round(n / step) * step;
/** A conservative growth guard, not an artistic quality score. Names, source
 * songs and seeds cannot manufacture a new reusable structural capability. */
function structure(entry: LibraryEntry): unknown {
  if (entry.layer === "scene")
    return {
      terrain: entry.recipe.terrain,
      road: entry.recipe.road,
      density: rounded(entry.recipe.density, 0.25),
      population: rounded(entry.recipe.population, 0.25),
      components: [...new Set(entry.recipe.components)].sort(),
      decorations: (entry.recipe.decorations ?? [])
        .map((ref) => `${ref.id}@${ref.version}`)
        .sort(),
    };
  if (entry.layer === "component") {
    const recipe = entry.recipe;
    if (recipe.generator === "existing") return recipe;
    if (recipe.generator === "branching-tree")
      return {
        generator: recipe.generator,
        revision: recipe.revision ?? 1,
        height: rounded(recipe.height, 2),
        spread: rounded(recipe.spread, 2),
        bloom: rounded(recipe.bloom, 0.25),
        fallingPetals: Boolean(recipe.fallingPetals),
      };
    if (recipe.generator === "cascade")
      return {
        generator: recipe.generator,
        height: rounded(recipe.height, 2),
        width: rounded(recipe.width, 2),
        tiers: recipe.tiers,
        revision: recipe.revision ?? 1,
      };
    if (recipe.generator === "colonnade")
      return {
        generator: recipe.generator,
        width: rounded(recipe.width, 2),
        length: rounded(recipe.length, 2),
        height: rounded(recipe.height, 1),
        bays: recipe.bays,
        roof: recipe.roof,
      };
    // Translation is an instance property. Small shifts or recolouring the same
    // assembly are variants, not independent library structures.
    const centroid = [0, 1, 2].map(
      (axis) =>
        recipe.parts.reduce((sum, part) => sum + part.position[axis], 0) /
        recipe.parts.length,
    );
    return {
      generator: recipe.generator,
      placement: recipe.placement,
      parts: recipe.parts
        .map((part) => ({
          shape: part.shape,
          position: part.position.map((v, axis) =>
            rounded(v - centroid[axis], 0.25),
          ),
          scale: part.scale.map((v) => rounded(v, 0.25)),
          rotation: (part.rotation ?? [0, 0, 0]).map((v) => rounded(v, 0.1)),
          glow: Boolean(part.glow),
        }))
        .sort((a, b) => canonical(a).localeCompare(canonical(b))),
    };
  }
  return undefined;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function sameAtmosphere(a: LibraryEntry, b: LibraryEntry) {
  if (a.layer !== "atmosphere" || b.layer !== "atmosphere") return false;
  const x = a.recipe,
    y = b.recipe;
  if (
    x.weather !== y.weather ||
    (x.weather !== "inherit" && Math.abs(x.intensity - y.intensity) > 0.1)
  )
    return false;
  const elevation = Math.abs(
    (x.lighting.sunElevation ?? 10) - (y.lighting.sunElevation ?? 10),
  );
  const azimuth = Math.abs(
    (((x.lighting.sunAzimuth ?? -170.54) -
      (y.lighting.sunAzimuth ?? -170.54) +
      540) %
      360) -
      180,
  );
  if (elevation > 12 || azimuth > 20) return false;
  for (const key of ["sky", "water", "ground", "light", "accent"] as const) {
    const u = rgb(x.lighting[key]),
      v = rgb(y.lighting[key]);
    if (Math.max(...u.map((n, i) => Math.abs(n - v[i]))) > 0.08) return false;
  }
  const tolerances = {
    night: 0.08,
    sun: 0.2,
    fog: 15,
    sparkle: 0.1,
    exposure: 0.08,
  };
  return Object.entries(tolerances).every(
    ([key, tolerance]) =>
      Math.abs(
        x.lighting[key as keyof typeof tolerances] -
          y.lighting[key as keyof typeof tolerances],
      ) <= tolerance,
  );
}
export function nearDuplicate(
  entry: LibraryEntry,
  library: CreativeLibrary,
): LibraryEntry | undefined {
  const signature = structure(entry);
  return library.entries.find((existing) => {
    if (
      existing.state === "retired" ||
      existing.layer !== entry.layer ||
      existing.styleId !== entry.styleId
    )
      return false;
    // Exact recipe reuse is handled by content identity, not rejected here.
    if (entryIdentity(existing) === entryIdentity(entry)) return false;
    if (entry.layer === "atmosphere") return sameAtmosphere(entry, existing);
    return canonical(signature) === canonical(structure(existing));
  });
}
