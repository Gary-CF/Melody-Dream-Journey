import { object, array, number, choice, text } from "./creative-validation";

/** Narrative scope is separate from the weather noun in a quoted fragment. */
export interface WeatherEvidence {
  version: 1;
  temporal: "present" | "past" | "future" | "uncertain";
  reality: "physical" | "memory" | "dream" | "metaphor" | "uncertain";
  polarity: "affirmed" | "negated" | "uncertain";
  presentation: "literal" | "evoked" | "none";
  sourceIds: number[];
  reason: string;
}
/** A documented absence of rain is a current fact too, even with no visual effect. */
export function isCurrentWeatherFact(
  scope: WeatherEvidence,
  kind: string,
): boolean {
  return (
    scope.temporal === "present" &&
    scope.reality === "physical" &&
    scope.polarity !== "uncertain" &&
    scope.sourceIds.length > 0 &&
    (kind === "clear" ||
      (scope.polarity === "affirmed" && scope.presentation === "literal"))
  );
}
export const weatherEvidenceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { const: 1 },
    temporal: {
      type: "string",
      enum: ["present", "past", "future", "uncertain"],
    },
    reality: {
      type: "string",
      enum: ["physical", "memory", "dream", "metaphor", "uncertain"],
    },
    polarity: { type: "string", enum: ["affirmed", "negated", "uncertain"] },
    presentation: { type: "string", enum: ["literal", "evoked", "none"] },
    sourceIds: {
      type: "array",
      items: { type: "integer", minimum: 1 },
      maxItems: 8,
    },
    reason: { type: "string", maxLength: 240 },
  },
  required: [
    "version",
    "temporal",
    "reality",
    "polarity",
    "presentation",
    "sourceIds",
    "reason",
  ],
} as const;
export function validateWeatherEvidence(raw: unknown): WeatherEvidence {
  const s = object(raw);
  if (s.version !== 1) throw Error("天气叙述范围版本无效");
  const sourceIds = array(s.sourceIds, "天气上下文证据", 0, 8).map((id) =>
    number(id, "证据编号", 1, 100000),
  );
  if (
    sourceIds.some((id) => !Number.isInteger(id)) ||
    new Set(sourceIds).size !== sourceIds.length
  )
    throw Error("天气上下文证据编号无效");
  return {
    version: 1,
    temporal: choice(
      s.temporal,
      weatherEvidenceSchema.properties.temporal.enum,
      "叙述时间",
    ),
    reality: choice(
      s.reality,
      weatherEvidenceSchema.properties.reality.enum,
      "现实范围",
    ),
    polarity: choice(
      s.polarity,
      weatherEvidenceSchema.properties.polarity.enum,
      "肯否判断",
    ),
    presentation: choice(
      s.presentation,
      weatherEvidenceSchema.properties.presentation.enum,
      "天气表现",
    ),
    sourceIds,
    reason: text(s.reason, "范围依据", 240),
  };
}
