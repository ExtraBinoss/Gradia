import { useEffect, useState, useRef } from "react";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { presets } from "@plinka/gradient-core";
import { thumbnail } from "./thumbnails";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShaderPreview } from "@/components/ShaderPreview";
import {
  applyChoiceAtom,
  previewChoiceAtom,
  currentNameAtom,
  activeSavedPresetAtom,
} from "./state";
export function Templates() {
  const { t } = useTranslation();
  const [images, setImages] = useState<Record<string, string>>({});
  const viewport = useRef<HTMLDivElement>(null);
  const apply = useSetAtom(applyChoiceAtom),
    preview = useSetAtom(previewChoiceAtom),
    setName = useSetAtom(currentNameAtom),
    setActive = useSetAtom(activeSavedPresetAtom);
  useEffect(() => {
    let live = true;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const preset = presets.find(
            (p) => p.id === (entry.target as HTMLElement).dataset.templateId,
          );
          if (preset)
            void thumbnail(preset.config).then(
              (image) => {
                if (live) setImages((previous) => ({ ...previous, [preset.id]: image }));
              },
              () => {},
            );
        }
      },
      { root: viewport.current, rootMargin: "80px" },
    );
    viewport.current
      ?.querySelectorAll("[data-template-id]")
      .forEach((card) => observer.observe(card));
    return () => {
      live = false;
      observer.disconnect();
      preview(null);
    };
  }, [preview]);
  return (
    <ScrollArea
      className="template-scroll"
      viewportRef={viewport}
      aria-label={t("templates")}
      onPointerLeave={() => preview(null)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) preview(null);
      }}
    >
      <div className="template-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            data-template-id={preset.id}
            className="template-card"
            aria-label={`Template ${preset.name}`}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") preview(preset);
            }}
            onFocus={() => preview(preset)}
            onClick={() => {
              apply(preset.config);
              setName(preset.name);
              setActive(null);
            }}
          >
            <span className="template-image">
              <ShaderPreview src={images[preset.id]} colors={preset.config.colors} />
            </span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
