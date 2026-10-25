import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { atom, createStore, type Atom } from "jotai";
import { parseConfig } from "@plinka/gradient-core";

let editor: typeof import("./state");
let effects: typeof import("./effect-state");
beforeAll(async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  editor = await import("./state");
  effects = await import("./effect-state");
});
afterAll(() => vi.unstubAllGlobals());
function fresh() {
  const store = createStore();
  store.set(editor.historyAtom, { past: [], present: parseConfig({ effects: [] }), future: [] });
  return store;
}

it("adding, duplicating, reordering and removing effects preserve independent data and undoable execution order", () => {
  const store = fresh();
  store.set(effects.addEffectAtom, "blocks");
  const original = store.get(editor.configAtom).effects[0];
  expect(store.get(effects.selectedEffectIdAtom)).toBe(original.id);
  store.set(effects.patchEffectAtom, {
    id: original.id,
    parameters: { feather: 0.63 },
    changes: { blendMode: "screen" },
  });
  store.set(effects.duplicateEffectAtom, original.id);
  const [first, duplicate] = store.get(editor.configAtom).effects;
  expect(duplicate.id).not.toBe(first.id);
  expect(duplicate.params).toEqual(first.params);
  expect(duplicate.params).not.toBe(first.params);
  expect(duplicate.blendMode).toBe("screen");
  expect(store.get(effects.selectedEffectIdAtom)).toBe(duplicate.id);
  store.set(effects.patchEffectAtom, { id: duplicate.id, parameters: { feather: 0.25 } });
  expect(store.get(editor.configAtom).effects[0].params).toHaveProperty("feather", 0.63);
  store.set(effects.addEffectAtom, "glass");
  const glass = store.get(editor.configAtom).effects[2];
  const prior = store.get(editor.configAtom);
  store.set(effects.reorderEffectsAtom, [first.id, glass.id, duplicate.id]);
  const reordered = store.get(editor.configAtom);
  expect(reordered.effects.map((effect) => effect.id)).toEqual([duplicate.id, glass.id, first.id]);
  expect(store.get(effects.effectOrderAtom)).toEqual([first.id, glass.id, duplicate.id]);
  expect(store.get(effects.selectedEffectIdAtom)).toBe(glass.id);
  store.set(editor.undoAtom);
  expect(store.get(editor.configAtom)).toEqual(prior);
  store.set(editor.redoAtom);
  expect(store.get(editor.configAtom)).toEqual(reordered);
  store.set(effects.removeEffectAtom, glass.id);
  expect(store.get(editor.configAtom).effects.map((effect) => effect.id)).toEqual([
    duplicate.id,
    first.id,
  ]);
  expect(store.get(effects.selectedEffectIdAtom)).toBe("gradient");
  expect(store.get(effects.selectedEffectTypeAtom)).toBe("gradient");
  store.set(editor.undoAtom);
  expect(store.get(editor.configAtom)).toEqual(reordered);
});

it("selection falls back to the gradient when undo removes its effect, and returns when redo restores it", () => {
  const store = fresh();
  store.set(effects.addEffectAtom, "folds");
  const selected = store.get(effects.selectedEffectIdAtom);
  expect(store.get(effects.selectedEffectTypeAtom)).toBe("folds");
  store.set(editor.undoAtom);
  expect(store.get(editor.configAtom).effects).toEqual([]);
  expect(store.get(effects.selectedEffectIdAtom)).toBe("gradient");
  expect(store.get(effects.selectedEffectTypeAtom)).toBe("gradient");
  store.set(editor.redoAtom);
  expect(store.get(effects.selectedEffectIdAtom)).toBe(selected);
  expect(store.get(effects.selectedEffectTypeAtom)).toBe("folds");
  store.set(editor.commitAtom, parseConfig({ effects: [] }));
  expect(store.get(effects.selectedEffectIdAtom)).toBe("gradient");
});

it("120 live parameter and opacity updates leave list order, other effects, selection and history subscribers idle", () => {
  const store = fresh();
  store.set(effects.addEffectAtom, "blocks");
  store.set(effects.addEffectAtom, "glass");
  const base = store.get(editor.configAtom);
  const block = base.effects[0],
    glass = base.effects[1];
  store.set(effects.selectedEffectIdAtom, block.id);
  const calls = { parameter: 0, order: 0, other: 0, selection: 0, type: 0, history: 0 };
  const releases: (() => void)[] = [];
  const watch = <T>(name: keyof typeof calls, target: Atom<T>) =>
    releases.push(store.sub(target, () => calls[name]++));
  watch(
    "parameter",
    atom((get) => {
      const effect = get(editor.configAtom).effects.find((effect) => effect.id === block.id);
      return effect?.type === "blocks" ? effect.params.feather : undefined;
    }),
  );
  watch("order", effects.effectOrderAtom);
  watch(
    "other",
    atom((get) => get(editor.configAtom).effects.find((effect) => effect.id === glass.id)),
  );
  watch("selection", effects.selectedEffectIdAtom);
  watch("type", effects.selectedEffectTypeAtom);
  watch("history", editor.historyAtom);
  const before = store.get(editor.historyAtom);
  for (let index = 1; index <= 120; index++)
    store.set(effects.patchEffectAtom, {
      id: block.id,
      parameters: { feather: index / 200 },
      changes: { opacity: 1 - index / 240 },
      preview: true,
    });
  expect(calls).toEqual({ parameter: 120, order: 0, other: 0, selection: 0, type: 0, history: 0 });
  expect(store.get(editor.historyAtom)).toBe(before);
  expect(store.get(editor.configAtom).effects[0]).toMatchObject({
    opacity: 0.5,
    params: { feather: 0.6 },
  });
  store.set(editor.previewAtom, null);
  expect(store.get(editor.configAtom)).toBe(base);
  expect(store.get(editor.historyAtom)).toBe(before);
  expect(calls.history).toBe(0);
  releases.forEach((release) => release());
});

it("a finished effect gesture commits once and can be undone or redone as a whole", () => {
  const store = fresh();
  store.set(effects.addEffectAtom, "glass");
  const base = store.get(editor.configAtom),
    effect = base.effects[0];
  const previousTransactions = store.get(editor.historyAtom).past.length;
  for (let index = 1; index <= 20; index++)
    store.set(effects.patchEffectAtom, {
      id: effect.id,
      parameters: { refraction: index / 20 },
      preview: true,
    });
  const preview = store.get(editor.configAtom);
  expect(store.get(editor.historyAtom).past).toHaveLength(previousTransactions);
  store.set(editor.commitAtom, preview);
  expect(store.get(editor.previewAtom)).toBeNull();
  expect(store.get(editor.historyAtom).past).toHaveLength(previousTransactions + 1);
  store.set(editor.undoAtom);
  expect(store.get(editor.configAtom)).toEqual(base);
  store.set(editor.redoAtom);
  expect(store.get(editor.configAtom)).toEqual(preview);
});

it("a stale drag result cannot lose, duplicate or invent an effect", () => {
  const store = fresh();
  store.set(effects.addEffectAtom, "ascii");
  store.set(effects.addEffectAtom, "dither");
  const history = store.get(editor.historyAtom),
    [first, second] = history.present.effects;
  for (const invalid of [[first.id], [first.id, first.id], [first.id, "missing"]]) {
    store.set(effects.reorderEffectsAtom, invalid);
    expect(store.get(editor.historyAtom)).toBe(history);
  }
  store.set(effects.reorderEffectsAtom, [first.id, second.id]);
  expect(store.get(editor.configAtom).effects.map((effect) => effect.id)).toEqual([
    second.id,
    first.id,
  ]);
});
