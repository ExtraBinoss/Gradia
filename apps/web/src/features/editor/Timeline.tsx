import { useEffect, useRef, useState, type RefObject } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  frame,
  cancelFrame,
  m,
  useMotionValue,
  useTransform,
  type MotionStyle,
} from "motion/react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, Infinity as InfinityIcon } from "lucide-react";
import type { GradientRenderer } from "@plinka/gradient-webgl";
import { Slider } from "@/components/ui/slider";
import { IconButton } from "./Controls";
import { parameterAtoms, playingAtom } from "./state";
export function Timeline({ rendererRef }: { rendererRef: RefObject<GradientRenderer | null> }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useAtom(playingAtom);
  const duration = useAtomValue(parameterAtoms.loopDuration);
  const [cursor, setCursor] = useState(0);
  const progress = useMotionValue(0);
  const position = useTransform(progress, (value) => `${Math.max(0, Math.min(1, value)) * 100}%`);
  const host = useRef<HTMLDivElement>(null),
    clock = useRef<HTMLSpanElement>(null),
    seekFrame = useRef(0),
    pending = useRef(0);
  useEffect(() => {
    const input = host.current?.querySelector("input");
    const sync = () => {
      const seconds = Math.min(
        seekFrame.current ? pending.current : (rendererRef.current?.time ?? 0),
        duration,
      );
      progress.set(seconds / duration);
      if (clock.current) clock.current.textContent = seconds.toFixed(2).padStart(5, "0");
      if (input && playing) {
        input.value = String(seconds);
        input.setAttribute("aria-valuenow", String(seconds));
      }
    };
    sync();
    if (playing) frame.update(sync, true);
    return () => cancelFrame(sync);
  }, [playing, duration, rendererRef, progress, cursor]);
  useEffect(
    () => () => {
      if (seekFrame.current) cancelAnimationFrame(seekFrame.current);
    },
    [],
  );
  return (
    <div className="timeline-row">
      <IconButton label={t(playing ? "pause" : "play")} onClick={() => setPlaying(!playing)}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </IconButton>
      <IconButton
        label={t("reset")}
        onClick={() => {
          if (seekFrame.current) cancelAnimationFrame(seekFrame.current);
          seekFrame.current = 0;
          rendererRef.current?.seek(0);
          setCursor(0);
          progress.set(0);
          if (clock.current) clock.current.textContent = "00.00";
        }}
      >
        <RotateCcw size={14} />
      </IconButton>
      <span className="timeline-time mono" ref={clock}>
        00.00
      </span>
      <m.div
        className="timeline-track"
        style={{ "--timeline-position": position } as MotionStyle}
        ref={host}
        onFocusCapture={() => {
          setCursor(
            Math.min(
              seekFrame.current ? pending.current : (rendererRef.current?.time ?? 0),
              duration,
            ),
          );
          setPlaying(false);
        }}
      >
        <Slider
          aria-label={t("timeline")}
          min={0}
          max={duration}
          step={1 / 60}
          value={[Math.min(cursor, duration)]}
          onValueChange={(v) => {
            const seconds = Array.isArray(v) ? v[0] : v;
            setPlaying(false);
            setCursor(seconds);
            pending.current = seconds;
            progress.set(seconds / duration);
            if (!seekFrame.current)
              seekFrame.current = requestAnimationFrame(() => {
                seekFrame.current = 0;
                rendererRef.current?.seek(pending.current);
              });
          }}
        />
        <span className="timeline-progress" />
        <span className="timeline-playhead" />
      </m.div>
      <span className="timeline-time mono">{duration.toFixed(1)}s</span>
      <InfinityIcon size={14} className="loop-icon" />
    </div>
  );
}
