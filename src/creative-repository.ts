import {
  validateLibraryDocument,
  mergeLibraryDocument,
  includeCurrentBuiltins,
  type LibraryDocument,
} from "./domain/library-document";
import type { KeyValueStore } from "./adapters/scoped-storage";
import { builtInCreativeLibrary } from "./domain/creative-catalog";
import {
  registerEntries,
  refKey,
  resolveEntry,
  type CreativeLibrary,
  type LibraryEntry,
  type LibraryUsage,
  type LibraryRef,
  type ReviewState,
} from "./domain/creative-library";
import { validateLibrary } from "./domain/creative-validation";
import { nearDuplicate } from "./domain/creative-novelty";
import { createCreativeHistory } from "./creative-history";

const libraryKey = "creative-library-v1";
/** Persist one validated document atomically; preserve originals separately from editable plans. */
export function createCreativeRepository(store: KeyValueStore) {
  function read(): LibraryDocument {
    const raw = store.getItem(libraryKey);
    if (!raw)
      return { version: 1, library: builtInCreativeLibrary(), usage: [] };
    return includeCurrentBuiltins(validateLibraryDocument(JSON.parse(raw)));
  }
  return {
    read,
    previewMerge(raw: unknown) {
      return mergeLibraryDocument(read(), raw);
    },
    merge(raw: unknown) {
      const result = mergeLibraryDocument(read(), raw);
      store.setItem(libraryKey, JSON.stringify(result.document));
      return structuredClone(result);
    },
    ...createCreativeHistory(store),
    commit(entries: LibraryEntry[], usage: LibraryUsage[]) {
      const doc = read();
      for (const entry of entries) {
        if (doc.library.entries.some((e) => refKey(e) === refKey(entry)))
          continue;
        const duplicate = nearDuplicate(entry, doc.library);
        if (duplicate)
          throw Error(
            `入库前复核：「${entry.name}」与已保存的「${duplicate.name}」差异不足，请复用原版本。`,
          );
      }
      const merged = registerEntries(doc.library, entries);
      const next = {
        version: 1 as const,
        library: validateLibrary(merged.library),
        usage: [...doc.usage],
        reviews: [...(doc.reviews ?? [])],
      };
      const keys = new Set(
        next.usage.map((u) => `${refKey(u.ref)}|${u.source}|${u.candidate}`),
      );
      for (const u of usage) {
        resolveEntry(next.library, u.ref);
        const key = `${refKey(u.ref)}|${u.source}|${u.candidate}`;
        if (!keys.has(key)) {
          keys.add(key);
          next.usage.push(structuredClone(u));
        }
      }
      if (next.usage.length > 4000)
        throw Error("复用记录达到本地容量，请导出归档后继续");
      store.setItem(libraryKey, JSON.stringify(next));
      return structuredClone(next);
    },
    review(ref: LibraryRef, state: ReviewState, note: string, at: string) {
      if (
        !["technical-preview", "stable", "retired"].includes(state) ||
        !note.trim() ||
        note.length > 500 ||
        !Number.isFinite(Date.parse(at))
      )
        throw Error("请提供有效的审阅状态、说明和时间");
      const doc = read();
      const entry = doc.library.entries.find((e) => refKey(e) === refKey(ref));
      if (!entry || entry.origin !== "generated")
        throw Error("只有生成入库的版本可以在此审阅");
      const reviews = [
        ...(doc.reviews ?? []),
        { ref: structuredClone(ref), state, note: note.trim(), at },
      ];
      if (reviews.length > 4000) throw Error("审阅记录达到容量，请先导出归档");
      entry.state = state;
      const next = { ...doc, reviews };
      store.setItem(libraryKey, JSON.stringify(next));
      return structuredClone(next);
    },
  };
}
