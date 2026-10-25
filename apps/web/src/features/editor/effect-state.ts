import { atom } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  createEffect,
  parseEffect,
  MAX_EFFECTS,
  type EffectType,
  type PostEffect,
} from "@plinka/gradient-core";
import { configAtom, historyAtom, previewAtom, hoverAtom, commitAtom } from "./state";
const requestedEffectIdAtom = atom("gradient");
export const selectedEffectIdAtom = atom(
  (get) => {
    const id = get(requestedEffectIdAtom);
    return get(configAtom).effects.some((effect) => effect.id === id) ? id : "gradient";
  },
  (_get, set, id: string) => set(requestedEffectIdAtom, id),
);
export const selectedEffectTypeAtom = atom(
  (get) =>
    get(configAtom).effects.find((effect) => effect.id === get(selectedEffectIdAtom))?.type ??
    "gradient",
);
export const effectOrderAtom = selectAtom(
  configAtom,
  (config) => config.effects.map((effect) => effect.id).reverse(),
  (previous, next) =>
    previous.length === next.length && previous.every((id, index) => id === next[index]),
);
export const addEffectAtom = atom(null, (get, set, type: EffectType) => {
  const config = get(previewAtom) ?? get(historyAtom).present;
  if (config.effects.length >= MAX_EFFECTS) return;
  const effect = createEffect(type, crypto.randomUUID());
  set(commitAtom, { ...config, effects: [...config.effects, effect] });
  set(requestedEffectIdAtom, effect.id);
});
export interface EffectEdit {
  id: string;
  changes?: Partial<Omit<PostEffect, "id" | "type" | "params">>;
  parameters?: Record<string, unknown>;
  preview?: boolean;
}
export const patchEffectAtom = atom(null, (get, set, patch: EffectEdit) => {
  const config = get(previewAtom) ?? get(historyAtom).present;
  if (!config.effects.some((effect) => effect.id === patch.id)) return;
  const effects = config.effects.map((effect) =>
    effect.id === patch.id
      ? parseEffect({
          ...effect,
          ...patch.changes,
          params: { ...effect.params, ...patch.parameters },
        })
      : effect,
  );
  if (patch.preview) {
    set(hoverAtom, null);
    set(previewAtom, { ...config, effects });
  } else set(commitAtom, { ...config, effects });
});
export const removeEffectAtom = atom(null, (get, set, id: string) => {
  const config = get(previewAtom) ?? get(historyAtom).present;
  set(commitAtom, { ...config, effects: config.effects.filter((effect) => effect.id !== id) });
  if (get(requestedEffectIdAtom) === id) set(requestedEffectIdAtom, "gradient");
});
export const duplicateEffectAtom = atom(null, (get, set, id: string) => {
  const config = get(previewAtom) ?? get(historyAtom).present;
  if (config.effects.length >= MAX_EFFECTS) return;
  const index = config.effects.findIndex((effect) => effect.id === id);
  if (index < 0) return;
  const effect = parseEffect({ ...config.effects[index], id: crypto.randomUUID() });
  const effects = [...config.effects];
  effects.splice(index + 1, 0, effect);
  set(commitAtom, { ...config, effects });
  set(requestedEffectIdAtom, effect.id);
});
export const reorderEffectsAtom = atom(null, (get, set, visualOrder: string[]) => {
  const config = get(previewAtom) ?? get(historyAtom).present;
  if (
    visualOrder.length !== config.effects.length ||
    new Set(visualOrder).size !== visualOrder.length
  )
    return;
  const effects = [...visualOrder]
    .reverse()
    .map((id) => config.effects.find((effect) => effect.id === id));
  if (effects.some((effect) => !effect)) return;
  set(commitAtom, { ...config, effects: effects as PostEffect[] });
});
