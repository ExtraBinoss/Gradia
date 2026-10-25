import { useEffect, useRef, useState, type RefObject } from "react";
import { useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { GradientRenderer } from "@plinka/gradient-webgl";
import { configAtom, playingAtom, transitionSequenceAtom, transitionTargetAtom } from "./state";
export function Canvas({ rendererRef }: { rendererRef: RefObject<GradientRenderer | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const store = useStore();
  const stats = useRef<HTMLSpanElement>(null);
  const { t } = useTranslation();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canvas.current) return;
    let renderer: GradientRenderer;
    try {
      renderer = new GradientRenderer(canvas.current, {
        config: store.get(configAtom),
        playing: store.get(playingAtom),
        respectReducedMotion: false,
        onStats: (s) => {
          if (stats.current)
            stats.current.textContent = s.fps
              ? `${s.fps} fps · ${s.width} × ${s.height}`
              : `${s.width} × ${s.height}`;
          setError("");
        },
        onError: (e) => setError(e.message === "WEBGL_CONTEXT_LOST" ? "contextLost" : "webglError"),
      });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report a one-time renderer startup failure.
      setError("webglError");
      return;
    }
    rendererRef.current = renderer;
    let sequence = store.get(transitionSequenceAtom);
    const unsubscribe = store.sub(configAtom, () => {
      const next = store.get(transitionSequenceAtom);
      const config = store.get(configAtom);
      if (next !== sequence && JSON.stringify(config) === store.get(transitionTargetAtom))
        renderer.transitionTo(
          config,
          matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.65,
        );
      else renderer.update(config);
      sequence = next;
    });
    const unsubscribePlaying = store.sub(playingAtom, () =>
      renderer.setPlaying(store.get(playingAtom)),
    );
    return () => {
      unsubscribe();
      unsubscribePlaying();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [store, rendererRef]);
  return (
    <>
      <canvas
        ref={canvas}
        className="gradient-canvas"
        aria-label={t("preview")}
        data-testid="gradient-canvas"
      />
      {error && (
        <div className="canvas-error" role="alert">
          {t(error)}
        </div>
      )}
      <span className="render-stats mono" ref={stats} />
    </>
  );
}

export function Stage({
  rendererRef,
  aspect,
}: {
  rendererRef: RefObject<GradientRenderer | null>;
  aspect: number | null;
}) {
  const host = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = host.current,
      board = frame.current;
    if (!parent || !board) return;
    const resize = () => {
      const width = parent.clientWidth,
        height = parent.clientHeight;
      if (aspect === null) {
        board.style.width = "100%";
        board.style.height = "100%";
        board.dataset.fit = "true";
      } else {
        const maxW = Math.max(1, width - 40),
          maxH = Math.max(1, height - 40);
        const w = Math.min(maxW, maxH * aspect);
        board.style.width = `${w}px`;
        board.style.height = `${w / aspect}px`;
        board.dataset.fit = "false";
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
  }, [aspect]);
  return (
    <main className="artboard" ref={host}>
      <div className="artboard-frame" ref={frame}>
        <Canvas rendererRef={rendererRef} />
      </div>
    </main>
  );
}
