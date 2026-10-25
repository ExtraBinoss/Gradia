import { it, expect, vi } from "vitest";
import { atom, createStore, type Atom } from "jotai";

it("120 live color changes notify only the selected color, preserving structural and history subscribers", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  try {
    const state = await import("./state");
    const store = createStore();
    const base = store.get(state.configAtom);
    const calls = { selected: 0, other: 0, structure: 0, numeric: 0, effects: 0, history: 0 };
    const releases: (() => void)[] = [];
    const watch = <T>(key: keyof typeof calls, target: Atom<T>) =>
      releases.push(store.sub(target, () => calls[key]++));
    watch(
      "selected",
      atom((get) => get(state.configAtom).colors[0]),
    );
    watch(
      "other",
      atom((get) => get(state.configAtom).colors[1]),
    );
    watch("structure", state.colorOrderAtom);
    watch("numeric", state.parameterAtoms.speed);
    watch("effects", state.effectSettingsAtom);
    watch("history", state.historyAtom);
    for (let index = 0; index < 120; index++)
      store.set(state.previewAtom, {
        ...base,
        colors: base.colors.map((color, i) =>
          i ? color : { ...color, color: `#${index.toString(16).padStart(6, "0")}` },
        ),
      });
    expect(calls).toEqual({
      selected: 120,
      other: 0,
      structure: 0,
      numeric: 0,
      effects: 0,
      history: 0,
    });
    store.set(state.commitAtom, store.get(state.configAtom));
    expect(calls.history).toBe(1);
    expect(calls.structure).toBe(0);
    releases.forEach((release) => release());
  } finally {
    vi.unstubAllGlobals();
  }
});
