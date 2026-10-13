import { colonnadePassage } from "./colonnade-generator";
import type { LibraryEntry } from "./creative-library";
import type { PassageCapability } from "./traversal";
import { coreAssets } from "../core-catalog";
import { builtInRecipes } from "../design";

const factoryPassages: Record<string, PassageCapability> = {
  "core-tavern": {
    halfLength: 6,
    width: 4.8,
    height: 4.8,
    focus: [-3, 1.6, 1],
    focusAsset: "core-bar",
    sheltered: true,
  },
};
/** Component-owned capability data, separate from song direction and world choice. */
export function componentPassage(
  entry: LibraryEntry,
): PassageCapability | undefined {
  if (entry.layer !== "component") return undefined;
  if (entry.recipe.generator === "colonnade")
    return colonnadePassage(entry.recipe);
  if (entry.recipe.generator === "existing") {
    const capability = factoryPassages[entry.recipe.assetId];
    return capability ? structuredClone(capability) : undefined;
  }
  return undefined;
}

export function canScatterComponent(entry: LibraryEntry): boolean {
  if (entry.layer !== "component" || entry.state === "retired") return false;
  if (componentPassage(entry)) return false;
  if (entry.recipe.generator !== "existing") return true;
  const assetId = entry.recipe.assetId;
  return (
    coreAssets.some((asset) => asset.id === assetId && !asset.sequenceOnly) ||
    builtInRecipes().some((recipe) => recipe.id === assetId)
  );
}
