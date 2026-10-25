import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { generateVariations, type GradientPreset } from "@plinka/gradient-core";
import { VariationTray } from "@/components/VariationTray";
import { ShaderPreview } from "@/components/ShaderPreview";
import { thumbnail } from "./thumbnails";
import {
  historyAtom,
  applyChoiceAtom,
  previewChoiceAtom,
  selectedPresetAtom,
  currentNameAtom,
  activeSavedPresetAtom,
  notificationAtom,
} from "./state";
interface Candidate extends GradientPreset {
  image: string;
}
export function Variations() {
  const { t } = useTranslation();
  const store = useStore();
  const history = useAtomValue(historyAtom);
  const [items, setItems] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const apply = useCallback(
    (candidate: GradientPreset) => {
      store.set(applyChoiceAtom, candidate.config);
      store.set(selectedPresetAtom, candidate.id);
      store.set(currentNameAtom, candidate.name);
      store.set(activeSavedPresetAtom, null);
    },
    [store],
  );
  const generate = useCallback(
    async (applyFirst: boolean) => {
      const revision = ++generation.current,
        seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const candidates = generateVariations(store.get(historyAtom).present, seed).map(
        (config, index) => ({
          id: `variation-${seed}-${index}`,
          name: `${t("variation")} ${index + 1}`,
          config,
        }),
      );
      setBusy(true);
      // Choices are usable immediately. Keep the previous captures while their
      // replacements render, so refreshes reveal through ShaderPreview's blend.
      setItems((previous) =>
        candidates.map((candidate, index) => ({
          ...candidate,
          image: previous[index]?.image ?? "",
        })),
      );
      if (applyFirst) apply(candidates[0]);
      try {
        await Promise.all(
          candidates.map(async (candidate) => {
            const image = await thumbnail(candidate.config);
            if (live.current && revision === generation.current)
              setItems((previous) =>
                previous.map((item) => (item.id === candidate.id ? { ...item, image } : item)),
              );
          }),
        );
      } catch {
        store.set(notificationAtom, "webglError");
      } finally {
        if (live.current && revision === generation.current) setBusy(false);
      }
    },
    [store, t, apply],
  );
  const preview = useCallback(
    (candidate: Candidate | null) => store.set(previewChoiceAtom, candidate),
    [store],
  );
  const selected = items.find(
    (candidate) => JSON.stringify(candidate.config) === JSON.stringify(history.present),
  )?.id;
  return (
    <VariationTray
      items={items}
      getKey={(candidate) => candidate.id}
      getLabel={(candidate, index) =>
        `${t("variation")} ${index + 1} · ${t(candidate.config.style)}`
      }
      renderPreview={(candidate) => (
        <ShaderPreview src={candidate.image} colors={candidate.config.colors} />
      )}
      onPreview={preview}
      onApply={apply}
      onOpen={() => {
        void generate(false);
      }}
      onRefresh={() => {
        void generate(true);
      }}
      selectedKey={selected}
      busy={busy}
      label={t("variations")}
      refreshLabel={t("newVariations")}
    />
  );
}
