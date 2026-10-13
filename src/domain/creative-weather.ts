import type { WeatherCue } from "../weather";
import type { AtmosphereRecipe } from "./creative-library";
import { isCurrentWeatherFact } from "./weather-evidence";

/** Confirmed current weather belongs to the evidence timeline. Cinematic color
 * design can supply missing weather, but cannot erase its event boundaries. */
export function creativeWeather(
  base: WeatherCue | undefined,
  atmosphere: AtmosphereRecipe,
  evidence: string,
): WeatherCue | undefined {
  if (
    (base?.scope
      ? isCurrentWeatherFact(base.scope, base.kind)
      : base?.context === "present") ||
    atmosphere.weather === "inherit"
  )
    return base ? structuredClone(base) : undefined;
  return {
    kind: atmosphere.weather,
    intensity: atmosphere.intensity,
    context: "unspecified",
    evidence,
  };
}
