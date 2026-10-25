import { useEffect, useRef, useState, type RefObject } from "react";
import { useSetAtom, useStore, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Circle,
  Ratio,
  Code2,
  Undo2,
  Redo2,
  Download,
  Infinity as InfinityIcon,
  X,
  Cog,
} from "lucide-react";
import type { GradientRenderer } from "@plinka/gradient-webgl";
import { Timeline } from "./Timeline";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconButton, Choice, NumberControl } from "./Controls";
import {
  configAtom,
  playingAtom,
  notificationAtom,
  historyAtom,
  undoAtom,
  redoAtom,
} from "./state";
import { download, exportPng } from "./export";
export function Toolbar({
  rendererRef,
  aspect,
  setAspect,
  onCode,
  onExport,
  onGlobalSettings,
}: {
  rendererRef: RefObject<GradientRenderer | null>;
  aspect: number | null;
  setAspect: (v: number | null) => void;
  onCode: () => void;
  onExport: () => void;
  onGlobalSettings: () => void;
}) {
  const { t } = useTranslation();
  const store = useStore();
  const history = useAtomValue(historyAtom);
  const setPlaying = useSetAtom(playingAtom);
  const [duration, setDuration] = useState(() => store.get(configAtom).loopDuration);
  const [customW, setCustomW] = useState("1920"),
    [customH, setCustomH] = useState("1080");
  const [format, setFormat] = useState("webm"),
    [fps, setFps] = useState("30"),
    [resolution, setResolution] = useState("1920");
  const [progress, setProgress] = useState<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(
    () => store.sub(configAtom, () => setDuration(store.get(configAtom).loopDuration)),
    [store],
  );
  useEffect(() => () => abort.current?.abort(), []);
  const dimensions = () => {
    const canvas = rendererRef.current?.canvas;
    const ratio = aspect ?? (canvas ? canvas.clientWidth / canvas.clientHeight : 16 / 9);
    const edge = Number(resolution);
    const w = ratio >= 1 ? edge : edge * ratio;
    return [
      Math.max(2, Math.round(w / 2) * 2),
      Math.max(2, Math.round(w / ratio / 2) * 2),
    ] as const;
  };
  const screenshot = () => {
    const [w, h] = dimensions();
    void exportPng(store.get(configAtom), rendererRef.current?.time ?? 0, w, h).then(
      () => store.set(notificationAtom, "exportDone"),
      () => store.set(notificationAtom, "error"),
    );
  };
  const record = async () => {
    const controller = new AbortController();
    abort.current = controller;
    const [width, height] = dimensions();
    const config = store.get(configAtom);
    setProgress(0);
    const wasPlaying = store.get(playingAtom);
    setPlaying(false);
    try {
      const { encodeVideo } = await import("./video");
      const blob = await encodeVideo(config, {
        width,
        height,
        fps: Number(fps),
        format: format as "mp4" | "webm",
        signal: controller.signal,
        onProgress: setProgress,
      });
      download(blob, `gradient-${width}x${height}-${config.loopDuration}s.${format}`);
      store.set(notificationAtom, "exportDone");
      setVideoOpen(false);
    } catch (error) {
      store.set(
        notificationAtom,
        controller.signal.aborted
          ? "canceled"
          : error instanceof Error && error.message === "UNSUPPORTED_CODEC"
            ? "unsupportedCodec"
            : "error",
      );
    } finally {
      setProgress(null);
      abort.current = null;
      setPlaying(wasPlaying);
    }
  };
  return (
    <>
      <div className="history-pill glass">
        {" "}
        <div className="dock-group" role="group" aria-label={t("historyActions")}>
          <IconButton
            label={t("undo")}
            disabled={!history.past.length}
            onClick={() => store.set(undoAtom)}
          >
            <Undo2 size={15} />
          </IconButton>
          <IconButton
            label={t("redo")}
            disabled={!history.future.length}
            onClick={() => store.set(redoAtom)}
          >
            <Redo2 size={15} />
          </IconButton>
        </div>
        <span className="toolbar-divider" />
        <IconButton label={t("globalSettings")} onClick={onGlobalSettings}>
          <Cog size={16} />
        </IconButton>
      </div>
      <div className="studio-dock">
        <div className="timeline-pill glass">
          <Timeline rendererRef={rendererRef} />
        </div>
        <div className="tools-pill glass">
          <div className="dock-actions">
            <div className="dock-group" role="group" aria-label={t("frameActions")}>
              <Popover>
                <PopoverTrigger
                  render={<Button variant="ghost" size="sm" aria-label={t("frame")} />}
                >
                  <Ratio size={15} />
                  <span>
                    {aspect === null
                      ? t("fit")
                      : Math.abs(aspect - 16 / 9) < 0.001
                        ? "16:9"
                        : Math.abs(aspect - 9 / 16) < 0.001
                          ? "9:16"
                          : aspect === 1
                            ? "1:1"
                            : t("custom")}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="ratio-popover">
                  <h3>{t("frame")}</h3>
                  <div className="ratio-grid">
                    {[
                      { label: t("fit"), value: null },
                      { label: "16:9", value: 16 / 9 },
                      { label: "4:3", value: 4 / 3 },
                      { label: "1:1", value: 1 },
                      { label: "3:4", value: 3 / 4 },
                      { label: "9:16", value: 9 / 16 },
                    ].map((r) => (
                      <Button
                        key={r.label}
                        variant={aspect === r.value ? "secondary" : "ghost"}
                        onClick={() => setAspect(r.value)}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                  <form
                    className="custom-ratio"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const w = Number(customW),
                        h = Number(customH);
                      if (w > 0 && h > 0 && w / h >= 0.1 && w / h <= 10) setAspect(w / h);
                    }}
                  >
                    <label>
                      {t("width")}
                      <input
                        aria-label={t("width")}
                        inputMode="numeric"
                        value={customW}
                        onChange={(e) => setCustomW(e.target.value)}
                      />
                    </label>
                    <span>×</span>
                    <label>
                      {t("height")}
                      <input
                        aria-label={t("height")}
                        inputMode="numeric"
                        value={customH}
                        onChange={(e) => setCustomH(e.target.value)}
                      />
                    </label>
                    <Button type="submit" size="sm">
                      OK
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger
                  render={<Button variant="ghost" size="sm" aria-label={t("loopDuration")} />}
                >
                  <InfinityIcon size={14} />
                  <span>{duration}s</span>
                </PopoverTrigger>
                <PopoverContent className="duration-popover">
                  <NumberControl name="loopDuration" step={1} />
                </PopoverContent>
              </Popover>
            </div>
            <span className="toolbar-divider" />
            <div className="dock-group" role="group" aria-label={t("captureActions")}>
              <Button
                variant="ghost"
                size="sm"
                className="capture-button"
                aria-label={t("screenshot")}
                onClick={screenshot}
              >
                <Camera size={16} />
                <span>PNG</span>
              </Button>
              <Popover open={videoOpen} onOpenChange={setVideoOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="record-trigger"
                      aria-label={t("record")}
                    />
                  }
                >
                  <Circle size={13} fill="currentColor" />
                  <span>REC</span>
                </PopoverTrigger>
                <PopoverContent className="record-popover">
                  <h3>{t("record")}</h3>
                  <div className="select-row">
                    <span>{t("videoFormat")}</span>
                    <Choice
                      label={t("videoFormat")}
                      value={format}
                      onChange={setFormat}
                      items={[
                        { label: "WebM · VP9", value: "webm" },
                        { label: "MP4 · H.264", value: "mp4" },
                      ]}
                    />
                  </div>
                  <div className="select-row">
                    <span>{t("resolution")}</span>
                    <Choice
                      label={t("resolution")}
                      value={resolution}
                      onChange={setResolution}
                      items={["720", "1280", "1920", "3840"].map((value) => ({
                        value,
                        label: `${value}px`,
                      }))}
                    />
                  </div>
                  <div className="select-row">
                    <span>{t("fps")}</span>
                    <Choice
                      label={t("fps")}
                      value={fps}
                      onChange={setFps}
                      items={["24", "30", "60"].map((value) => ({ value, label: `${value} fps` }))}
                    />
                  </div>
                  <p className="subtle">
                    {duration}s · {Math.round(duration * Number(fps))} frames · {t("loop")}
                  </p>
                  {progress !== null ? (
                    <>
                      <div className="encoding-progress">
                        <span style={{ width: `${progress * 100}%` }} />
                      </div>
                      <Button variant="outline" onClick={() => abort.current?.abort()}>
                        <X size={14} />
                        {t("cancel")} · {Math.round(progress * 100)}%
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => {
                        void record();
                      }}
                    >
                      <Download size={14} />
                      {t("record")}
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <span className="toolbar-divider" />
            <div className="dock-group" role="group" aria-label={t("integrationActions")}>
              <IconButton label={t("code")} onClick={onCode}>
                <Code2 size={17} />
              </IconButton>
              <Button className="export-primary" onClick={onExport}>
                <Download size={15} />
                {t("export")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
