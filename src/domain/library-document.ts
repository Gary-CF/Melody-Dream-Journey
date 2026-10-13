import {
  validateLibrary,
  object,
  array,
  text,
  number,
  choice,
} from "./creative-validation";
import {
  registerEntries,
  entryIdentity,
  refKey,
  type CreativeLibrary,
  type LibraryUsage,
  type LibraryRef,
  type ReviewState,
} from "./creative-library";
import { builtInCreativeLibrary } from "./creative-catalog";
import { nearDuplicate } from "./creative-novelty";

export interface LibraryDocument {
  version: 1;
  library: CreativeLibrary;
  usage: LibraryUsage[];
  reviews?: { ref: LibraryRef; state: ReviewState; note: string; at: string }[];
}
/** Add newly shipped factories without rewriting saved versions or review decisions. */
export function includeCurrentBuiltins(
  document: LibraryDocument,
): LibraryDocument {
  const next = structuredClone(document);
  for (const entry of builtInCreativeLibrary().entries) {
    const old = next.library.entries.find((e) => refKey(e) === refKey(entry));
    if (old) {
      if (
        old.origin !== "builtin" ||
        entryIdentity(old) !== entryIdentity(entry)
      )
        throw Error(`已有基础库版本与当前定义冲突：${refKey(entry)}`);
    } else next.library.entries.push(entry);
  }
  return validateLibraryDocument(next);
}
const ref = (raw: unknown): LibraryRef => {
  const r = object(raw),
    version = number(r.version, "库版本", 1, 9999);
  if (!Number.isInteger(version)) throw Error("库版本必须为整数");
  return { id: text(r.id, "库引用", 64), version };
};
export function validateLibraryDocument(raw: unknown): LibraryDocument {
  const d = object(raw);
  if (d.version !== 1) throw Error("不支持此创作库备份版本");
  const library = validateLibrary(d.library),
    keys = new Set(library.entries.map(refKey));
  const knownRef = (raw: unknown) => {
    const r = ref(raw);
    if (!keys.has(refKey(r))) throw Error(`库记录引用了缺失版本：${refKey(r)}`);
    return r;
  };
  const usage = array(d.usage ?? [], "复用记录", 0, 4000).map((raw) => {
    const u = object(raw);
    return {
      ref: knownRef(u.ref),
      source: text(u.source, "复用来源", 200),
      candidate: text(u.candidate, "创作标识", 100),
    };
  });
  const reviews = array(d.reviews ?? [], "审阅记录", 0, 4000).map((raw) => {
    const r = object(raw),
      at = text(r.at, "审阅时间", 60);
    if (!Number.isFinite(Date.parse(at))) throw Error("审阅时间无效");
    return {
      ref: knownRef(r.ref),
      state: choice(
        r.state,
        ["technical-preview", "stable", "retired"] as const,
        "审阅状态",
      ),
      note: text(r.note, "审阅说明", 500),
      at,
    };
  });
  for (const e of library.entries)
    if (e.layer === "scene")
      for (const dependency of e.recipe.decorations ?? []) {
        const target = library.entries.find(
          (x) => refKey(x) === refKey(dependency),
        );
        if (target?.layer !== "component")
          throw Error(`场景依赖了缺失的组件版本：${refKey(dependency)}`);
      }
  return { version: 1, library, usage, reviews };
}

/** Merge only. Existing recipes, review decisions and provenance are never replaced.
 * A conflict rejects the entire import before the repository writes anything. */
export function mergeLibraryDocument(
  currentRaw: unknown,
  incomingRaw: unknown,
) {
  const current = validateLibraryDocument(currentRaw),
    incoming = validateLibraryDocument(incomingRaw);
  const baseline = builtInCreativeLibrary(),
    mapping = new Map<string, LibraryRef>();
  let library = current.library,
    added = 0,
    reused = 0;
  // Components precede scenes so dependency references can be mapped to an exact reused identity.
  const ordered = [...incoming.library.entries].sort(
    (a, b) => Number(a.layer === "scene") - Number(b.layer === "scene"),
  );
  for (const original of ordered) {
    const entry = structuredClone(original),
      key = refKey(entry);
    if (entry.origin === "builtin") {
      const builtin = baseline.entries.find((e) => refKey(e) === key);
      if (!builtin || entryIdentity(builtin) !== entryIdentity(entry))
        throw Error(`备份不能改写内置版本：${key}`);
    }
    const sameVersion = library.entries.find((e) => refKey(e) === key);
    if (sameVersion) {
      if (
        entryIdentity(sameVersion) !== entryIdentity(entry) ||
        sameVersion.origin !== entry.origin
      )
        throw Error(`库版本冲突：${key}；原配方保持不变`);
      mapping.set(key, { id: sameVersion.id, version: sameVersion.version });
      reused++;
      continue;
    }

    const duplicate = nearDuplicate(entry, library);
    if (duplicate)
      throw Error(
        `「${entry.name}」与「${duplicate.name}」差异不足，请保留原版本或先审阅合并`,
      );
    const merged = registerEntries(library, [entry]);
    if (refKey(merged.refs[0]) !== key)
      throw Error(
        `相同配方已使用版本 ${refKey(merged.refs[0])}，备份别名不能改写既有来源`,
      );
    if (merged.library.entries.length === library.entries.length) reused++;
    else added++;
    library = merged.library;
    mapping.set(key, merged.refs[0]);
  }
  const mapRef = (r: LibraryRef) => mapping.get(refKey(r)) ?? r;
  const usage = [...current.usage],
    usageKeys = new Set(
      usage.map((u) => `${refKey(u.ref)}|${u.source}|${u.candidate}`),
    );
  for (const original of incoming.usage) {
    const u = { ...original, ref: mapRef(original.ref) },
      key = `${refKey(u.ref)}|${u.source}|${u.candidate}`;
    if (!usageKeys.has(key)) {
      usage.push(u);
      usageKeys.add(key);
    }
  }
  const reviews = [...(current.reviews ?? [])],
    reviewKeys = new Set(reviews.map((r) => JSON.stringify(r)));
  for (const original of incoming.reviews ?? []) {
    const r = { ...original, ref: mapRef(original.ref) },
      key = JSON.stringify(r);
    if (!reviewKeys.has(key)) {
      reviews.push(r);
      reviewKeys.add(key);
    }
  }
  const document = validateLibraryDocument({
    version: 1,
    library,
    usage,
    reviews,
  });
  return { document, added, reused, preservedReviews: true as const };
}
