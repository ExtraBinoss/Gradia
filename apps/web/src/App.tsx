import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { useAtom, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { serializeConfig } from "@plinka/gradient-core";
import type { GradientRenderer } from "@plinka/gradient-webgl";
import { Settings, IconButton } from "@/features/editor/Controls";
import { Presets } from "@/features/editor/Presets";
import { Variations } from "@/features/editor/Library";
import { Stage } from "@/features/editor/Preview";
import { Toolbar } from "@/features/editor/Toolbar";
import { GlobalSettings } from "@/features/editor/GlobalSettings";
import { AnimatePresence } from "motion/react";
import { StudioIntro } from "@/components/StudioIntro";
const CodeDialog = lazy(() =>
  import("@/features/editor/Dialogs").then((m) => ({ default: m.CodeDialog })),
);
const ExportDialog = lazy(() =>
  import("@/features/editor/Dialogs").then((m) => ({ default: m.ExportDialog })),
);
import {
  notificationAtom,
  historyAtom,
  currentNameAtom,
  activeSavedPresetAtom,
  undoAtom,
  redoAtom,
  playingAtom,
} from "@/features/editor/state";
function Notification() {
  const [message, setMessage] = useAtom(notificationAtom);
  const { t } = useTranslation();
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(id);
  }, [message, setMessage]);
  return message ? (
    <div className="notification" role="status">
      <Check size={15} />
      {t(message)}
      <IconButton label={t("close")} onClick={() => setMessage("")}>
        <X size={13} />
      </IconButton>
    </div>
  ) : null;
}
function Lifecycle() {
  const store = useStore();
  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem("gradient-document", serializeConfig(store.get(historyAtom).present));
      } catch {
        store.set(notificationAtom, "storageError");
      }
    };
    const unsub = store.sub(historyAtom, persist);
    let nameTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubName = store.sub(currentNameAtom, () => {
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => {
        try {
          localStorage.setItem("gradient-current-name", store.get(currentNameAtom));
        } catch {
          /* Optional label persistence. */
        }
      }, 200);
    });
    const unsubActive = store.sub(activeSavedPresetAtom, () => {
      try {
        localStorage.setItem(
          "gradient-active-saved",
          JSON.stringify(store.get(activeSavedPresetAtom)),
        );
      } catch {
        /* Optional selection persistence. */
      }
    });
    const keyboard = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,[role="slider"],[role="dialog"],[contenteditable="true"]',
        )
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        store.set(e.shiftKey ? redoAtom : undoAtom);
      } else if (e.code === "Space" && !target.closest('button,[role="tab"],[role="switch"]')) {
        e.preventDefault();
        store.set(playingAtom, !store.get(playingAtom));
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      unsub();
      unsubName();
      unsubActive();
      clearTimeout(nameTimer);
      window.removeEventListener("keydown", keyboard);
    };
  }, [store]);
  return null;
}
export function App() {
  const { t } = useTranslation();
  const [intro, setIntro] = useState(true);
  const finishIntro = useCallback(() => setIntro(false), []);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false),
    [exportOpen, setExportOpen] = useState(false);
  const [exportRatio, setExportRatio] = useState(16 / 9),
    [aspect, setAspect] = useState<number | null>(null);
  const renderer = useRef<GradientRenderer | null>(null);
  const openExport = () => {
    const canvas = renderer.current?.canvas;
    setExportRatio(
      canvas && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : 16 / 9,
    );
    setExportOpen(true);
  };
  return (
    <div className="studio" data-settings-open="true">
      <Lifecycle />
      <Stage rendererRef={renderer} aspect={aspect} />
      <div className="studio-interface" inert={intro} data-loading={intro}>
        <div className="top-left-controls">
          <header className="studio-pill glass">
            <a
              className="brand"
              href="https://plinka.eu"
              target="_blank"
              rel="noreferrer"
              aria-label="Plinka"
            >
              <span className="plinka-mark" />
            </a>
            <span className="toolbar-divider" />
            <h1>{t("studio")}</h1>
            <a
              className="studio-github"
              href="https://github.com/ExtraBinoss/Gradia"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("githubLink")}
              title="GitHub · Gradia"
            >
              <span className="github-brand-icon" aria-hidden="true" />
            </a>
            <span className="toolbar-divider" />
            <Presets />
          </header>
        </div>
        <div className="settings-float glass">
          <Settings />
        </div>
        <Variations />
        <Toolbar
          rendererRef={renderer}
          aspect={aspect}
          setAspect={setAspect}
          onCode={() => setCodeOpen(true)}
          onExport={openExport}
          onGlobalSettings={() => setGlobalOpen(true)}
        />
        <Suspense fallback={null}>
          {codeOpen && <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} />}
          {exportOpen && (
            <ExportDialog
              open={exportOpen}
              onOpenChange={setExportOpen}
              rendererRef={renderer}
              aspectRatio={exportRatio}
            />
          )}
        </Suspense>
        <GlobalSettings open={globalOpen} onOpenChange={setGlobalOpen} />
        <Notification />
      </div>
      <AnimatePresence>
        {intro && <StudioIntro key="intro" rendererRef={renderer} onComplete={finishIntro} />}
      </AnimatePresence>
    </div>
  );
}
