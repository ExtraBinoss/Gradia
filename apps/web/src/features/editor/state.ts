import { ranges } from "@plinka/gradient-core";
import { atom, createStore } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  DEFAULT_CONFIG,
  deserializeConfig,
  parseConfig,
  presets,
  commit,
  undo,
  redo,
  type GradientConfig,
  type GradientPreset,
  type History,
} from "@plinka/gradient-core";
export const editorStore = createStore();
function initial(): GradientConfig {
  try {
    if (location.hash.startsWith("#config="))
      return deserializeConfig(decodeURIComponent(location.hash.slice(8)));
  } catch {
    /* Invalid link: retain a usable editor. */
  }
  try {
    const saved = localStorage.getItem("gradient-document");
    if (saved) return deserializeConfig(saved);
  } catch {
    /* Invalid or unavailable storage. */
  }
  return parseConfig(DEFAULT_CONFIG);
}
export const historyAtom = atom<History>({ past: [], present: initial(), future: [] });
export const previewAtom = atom<GradientConfig | null>(null);
export const hoverAtom = atom<GradientPreset | null>(null);
export const configAtom = atom(
  (get) => get(hoverAtom)?.config ?? get(previewAtom) ?? get(historyAtom).present,
);
export const commitAtom = atom(null, (get, set, config: GradientConfig) => {
  set(historyAtom, commit(get(historyAtom), parseConfig(config)));
  set(previewAtom, null);
  set(hoverAtom, null);
});
export const undoAtom = atom(null, (get, set) => {
  set(historyAtom, undo(get(historyAtom)));
  set(previewAtom, null);
  set(hoverAtom, null);
});
export const redoAtom = atom(null, (get, set) => {
  set(historyAtom, redo(get(historyAtom)));
  set(previewAtom, null);
  set(hoverAtom, null);
});
export const playingAtom = atom(!matchMedia("(prefers-reduced-motion: reduce)").matches);
export const selectedPresetAtom = atom<string>(presets[0].id);
export const notificationAtom = atom("");
export const currentNameAtom = atom(
  (() => {
    try {
      return localStorage.getItem("gradient-current-name") || "Daydream";
    } catch {
      return "Daydream";
    }
  })(),
);
type SavedSelection = { id: string; name: string; fingerprint: string };
export const activeSavedPresetAtom = atom<SavedSelection | null>(
  ((): SavedSelection | null => {
    try {
      const raw = JSON.parse(localStorage.getItem("gradient-active-saved") || "null");
      if (
        raw &&
        typeof raw.id === "string" &&
        typeof raw.name === "string" &&
        typeof raw.fingerprint === "string"
      )
        return raw;
    } catch {
      /* No previous selection. */
    }
    return null;
  })(),
);
export const parameterAtoms = Object.fromEntries(
  Object.keys(ranges).map((key) => [
    key,
    atom((get) => get(configAtom)[key as keyof typeof ranges]),
  ]),
) as Record<keyof typeof ranges, ReturnType<typeof atom<number>>>;
export const effectAtom = atom((get) => get(configAtom).effect);
export const shaderStyleAtom = atom((get) => get(configAtom).style);
export const colorsAtom = atom((get) => get(configAtom).colors);

export const transitionSequenceAtom = atom(0);
export const transitionTargetAtom = atom("");
export const applyChoiceAtom = atom(null, (get, set, config: GradientConfig) => {
  set(commitAtom, config);
  set(transitionTargetAtom, JSON.stringify(get(configAtom)));
  set(transitionSequenceAtom, get(transitionSequenceAtom) + 1);
});
export const previewChoiceAtom = atom(null, (get, set, preset: GradientPreset | null) => {
  set(hoverAtom, preset);
  set(transitionTargetAtom, JSON.stringify(get(configAtom)));
  set(transitionSequenceAtom, get(transitionSequenceAtom) + 1);
});

// Structural subscriptions remain stable while a single color changes continuously.
export const colorOrderAtom = selectAtom(
  configAtom,
  (config) => config.colors.map((color) => color.id),
  (a, b) => a.length === b.length && a.every((id, index) => id === b[index]),
);
export const colorCountAtom = atom((get) => get(colorOrderAtom).length);
export const activeColorCountAtom = atom(
  (get) => get(configAtom).colors.filter((color) => color.enabled).length,
);
export const booleanAtoms = {
  asciiColored: atom((get) => get(configAtom).asciiColored),
  asciiInvert: atom((get) => get(configAtom).asciiInvert),
  ditherMonochrome: atom((get) => get(configAtom).ditherMonochrome),
};
export const toneAtoms = {
  asciiColor: atom((get) => get(configAtom).asciiColor),
  backgroundColor: atom((get) => get(configAtom).backgroundColor),
};
export const effectSettingsAtom = selectAtom(
  configAtom,
  (c) => ({
    effect: c.effect,
    asciiCharacters: c.asciiCharacters,
    ditherPattern: c.ditherPattern,
    ditherMonochrome: c.ditherMonochrome,
  }),
  (a, b) =>
    a.effect === b.effect &&
    a.asciiCharacters === b.asciiCharacters &&
    a.ditherPattern === b.ditherPattern &&
    a.ditherMonochrome === b.ditherMonochrome,
);

export const integrationFormatAtom = atom<"react" | "javascript" | "json">("react");
export const integrationDistributionAtom = atom<"source" | "minified">("minified");
export const integrationCopiedAtom = atom<"code" | "prompt" | null>(null);
