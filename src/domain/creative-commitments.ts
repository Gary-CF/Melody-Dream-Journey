import { array, choice, number, object, text } from "./creative-validation";

export interface CreativeCommitment {
  id: string;
  kind: "subject" | "action" | "event";
  description: string;
  /** Open vocabulary: unsupported requests survive matching as explicit gaps. */
  capability: string;
  representation: "literal" | "metaphor";
  essential: boolean;
}
export interface CommitmentBinding {
  claimId: string;
  target: "component" | "observer" | "lighting" | "unresolved";
  objectIndex: number;
  reason: string;
}
export const observerCapabilities = [
  "walk",
  "pause",
  "look",
  "enter-exit",
] as const;
export const lightingCapabilities = ["lighting-transition"] as const;
export const commitmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", pattern: "^[a-z][a-z0-9-]{0,39}$" },
    kind: { type: "string", enum: ["subject", "action", "event"] },
    description: { type: "string", maxLength: 180 },
    capability: { type: "string", pattern: "^[a-z][a-z0-9-]{0,59}$" },
    representation: { type: "string", enum: ["literal", "metaphor"] },
    essential: { type: "boolean" },
  },
  required: [
    "id",
    "kind",
    "description",
    "capability",
    "representation",
    "essential",
  ],
} as const;
export const commitmentBindingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    claimId: { type: "string", maxLength: 40 },
    target: {
      type: "string",
      enum: ["component", "observer", "lighting", "unresolved"],
    },
    objectIndex: { type: "integer", minimum: -1, maximum: 6 },
    reason: { type: "string", maxLength: 160 },
  },
  required: ["claimId", "target", "objectIndex", "reason"],
} as const;
export function validateCommitments(raw: unknown): CreativeCommitment[] {
  const claims = array(raw, "必要画面声明", 1, 10).map((value) => {
    const c = object(value),
      id = text(c.id, "声明编号", 40),
      capability = text(c.capability, "画面能力", 60);
    if (
      !/^[a-z][a-z0-9-]*$/.test(id) ||
      !/^[a-z][a-z0-9-]*$/.test(capability) ||
      typeof c.essential !== "boolean"
    )
      throw Error("画面声明格式无效");
    return {
      id,
      capability,
      kind: choice(c.kind, ["subject", "action", "event"] as const, "声明类别"),
      description: text(c.description, "必要画面", 180),
      representation: choice(
        c.representation,
        ["literal", "metaphor"] as const,
        "表现关系",
      ),
      essential: c.essential,
    };
  });
  if (
    new Set(claims.map((c) => c.id)).size !== claims.length ||
    !(claims[0].kind === "subject" && claims[0].essential)
  )
    throw Error("必要画面需要唯一声明编号及主要主体");
  return claims;
}
export function validateCommitmentBindings(
  raw: unknown,
  claims: CreativeCommitment[],
  objectCount: number,
): CommitmentBinding[] {
  const bindings = array(raw, "画面执行绑定", 1, 10).map((value) => {
    const b = object(value),
      claimId = text(b.claimId, "声明引用", 40),
      objectIndex = number(b.objectIndex, "绑定对象", -1, objectCount - 1);
    if (!claims.some((c) => c.id === claimId) || !Number.isInteger(objectIndex))
      throw Error("画面绑定引用无效");
    const target = choice(
      b.target,
      ["component", "observer", "lighting", "unresolved"] as const,
      "执行目标",
    );
    if ((target === "component") !== objectIndex >= 0)
      throw Error("组件绑定需要对象编号，轨道绑定不得冒充对象");
    return {
      claimId,
      target,
      objectIndex,
      reason: text(b.reason, "执行依据", 160),
    };
  });
  if (
    new Set(bindings.map((b) => b.claimId)).size !== bindings.length ||
    claims.some((c) => !bindings.some((b) => b.claimId === c.id))
  )
    throw Error("每项画面声明都必须绑定或明确未解决");
  const primary = bindings.find((b) => b.claimId === claims[0].id)!;
  if (
    primary.target !== "unresolved" &&
    (primary.target !== "component" || primary.objectIndex !== 0)
  )
    throw Error("主要主体承诺必须绑定主要组件，不能由配景或观察者代替");
  return bindings;
}
