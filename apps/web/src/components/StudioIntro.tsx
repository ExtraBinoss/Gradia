import { useEffect, useRef, type RefObject } from "react";
import { m, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { presets } from "@plinka/gradient-core";
import type { GradientRenderer } from "@plinka/gradient-webgl";
import { configAtom, playingAtom } from "@/features/editor/state";
import { Button } from "@/components/ui/button";

/** A short brand sequence on the existing studio canvas; no extra WebGL context. */
export function StudioIntro({
  rendererRef,
  onComplete,
}: {
  rendererRef: RefObject<GradientRenderer | null>;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const store = useStore();
  const reduced = useReducedMotion();
  const restore = useRef<() => void>(() => {});
  const cancelSequence = useRef<() => void>(() => {});
  useEffect(() => {
    const renderer = rendererRef.current;
    const time = renderer?.time ?? 0;
    let restored = false;
    restore.current = () => {
      if (restored) return;
      restored = true;
      renderer?.transitionTo(store.get(configAtom), reduced ? 0 : 0.5);
      renderer?.seek(time);
      renderer?.setPlaying(store.get(playingAtom));
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    cancelSequence.current = () => timers.forEach(clearTimeout);
    if (!reduced && renderer) {
      renderer.setPlaying(true);
      renderer.transitionTo(presets[1].config, 0.6);
      timers.push(setTimeout(() => renderer.transitionTo(presets[4].config, 0.6), 650));
      timers.push(setTimeout(() => renderer.transitionTo(presets[2].config, 0.6), 1250));
    }
    timers.push(setTimeout(() => restore.current(), 1950));
    timers.push(setTimeout(onComplete, 2150));
    return () => {
      cancelSequence.current();
      restore.current();
    };
  }, [rendererRef, store, reduced, onComplete]);
  return (
    <m.div
      className="studio-intro"
      data-testid="studio-intro"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.35 }}
    >
      <div className="intro-topline">
        <span className="intro-edition">
          PLINKA <span>/</span> CREATIVE TOOLS
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            cancelSequence.current();
            restore.current();
            onComplete();
          }}
        >
          {t("skipIntro")} <ArrowRight size={15} />
        </Button>
      </div>
      <div className="intro-lockup">
        <span className="plinka-mark intro-mark" aria-label="Plinka" role="img" />
        <h2>Gradia</h2>
        <p>{t("loadingStudio")}</p>
      </div>
      <div className="intro-progress" aria-hidden="true">
        <span />
      </div>
    </m.div>
  );
}
