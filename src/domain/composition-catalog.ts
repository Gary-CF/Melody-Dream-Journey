import type { Theme, Asset } from "../model";
export const compositionAssets: Record<Theme, Asset[]> = {
  shade: ["tree", "shop", "home", "lamp", "person", "bench"],
  sunset: ["tree", "shop", "tower", "lamp", "bus", "stop", "person"],
  night: ["shop", "home", "lamp", "person", "bench"],
  river: ["tree", "lamp", "bench"],
  ridge: ["tree", "bench"],
};
