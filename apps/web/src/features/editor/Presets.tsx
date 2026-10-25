import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { Save, ChevronDown, Plus, Trash2, Check, LoaderCircle } from "lucide-react";
import { parseConfig } from "@plinka/gradient-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShaderPreview } from "@/components/ShaderPreview";
import { Popover, PopoverContent, PopoverTrigger, PopoverTitle } from "@/components/ui/popover";
import { IconButton } from "./Controls";
import {
  currentNameAtom,
  activeSavedPresetAtom,
  historyAtom,
  applyChoiceAtom,
  previewChoiceAtom,
  notificationAtom,
  selectedPresetAtom,
} from "./state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Templates } from "./Templates";
import { thumbnail } from "./thumbnails";
import {
  migrateLegacyPresets,
  readPresets,
  putPreset,
  removePreset,
  getPreset,
  type SavedGradient,
  type PresetCursor,
} from "./preset-storage";
export function Presets() {
  const { t } = useTranslation();
  const store = useStore();
  const [name, setName] = useAtom(currentNameAtom),
    [active, setActive] = useAtom(activeSavedPresetAtom);
  const history = useAtomValue(historyAtom);
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<SavedGradient[]>([]),
    [next, setNext] = useState<PresetCursor | null>(null),
    [total, setTotal] = useState(0),
    [busy, setBusy] = useState(false),
    [currentImage, setCurrentImage] = useState("");
  const loading = useRef(false),
    scroll = useRef<HTMLDivElement>(null),
    sentinel = useRef<HTMLDivElement>(null);
  const fingerprint = JSON.stringify(history.present),
    modified =
      active !== null && (active.fingerprint !== fingerprint || active.name !== name.trim());
  const load = useCallback(
    async (cursor: PresetCursor | null = null) => {
      if (loading.current) return;
      loading.current = true;
      try {
        await migrateLegacyPresets();
        const page = await readPresets(cursor);
        setItems((previous) => (cursor ? [...previous, ...page.items] : page.items));
        setNext(page.next);
        setTotal(page.total);
      } catch {
        store.set(notificationAtom, "storageError");
      } finally {
        loading.current = false;
      }
    },
    [store],
  );
  useEffect(() => {
    if (!open) return;
    let live = true;
    void thumbnail(history.present).then(
      (src) => {
        if (live) setCurrentImage(src);
      },
      () => {},
    );
    return () => {
      live = false;
      store.set(previewChoiceAtom, null);
    };
  }, [open, history.present, store]);
  useEffect(() => {
    const target = sentinel.current;
    if (!open || !next || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(next);
      },
      { root: scroll.current, rootMargin: "150px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, next, load]);
  const save = async (copy = false) => {
    if (busy) return;
    setBusy(true);
    const config = parseConfig(store.get(historyAtom).present);
    const id = !copy && active ? active.id : crypto.randomUUID();
    const title = name.trim() || t("untitled");
    try {
      const previous = await getPreset(id);
      const record: SavedGradient = {
        id,
        name: title,
        config,
        thumbnail: await thumbnail(config),
        createdAt: previous?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        custom: true,
      };
      await putPreset(record);
      setActive({ id, name: title, fingerprint: JSON.stringify(config) });
      setName(title);
      try {
        localStorage.setItem("gradient-current-name", title);
      } catch {
        /* The preset is already durable in IndexedDB. */
      }
      store.set(notificationAtom, "saved");
      await load();
    } catch {
      store.set(notificationAtom, "storageError");
    } finally {
      setBusy(false);
    }
  };
  const choose = (preset: SavedGradient) => {
    store.set(applyChoiceAtom, preset.config);
    store.set(selectedPresetAtom, "");
    setName(preset.name);
    try {
      localStorage.setItem("gradient-current-name", preset.name);
    } catch {
      /* Optional working label. */
    }
    setActive({ id: preset.id, name: preset.name, fingerprint: JSON.stringify(preset.config) });
    store.set(previewChoiceAtom, null);
  };
  return (
    <div className="preset-controls glass">
      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (value) void load();
          else {
            store.set(previewChoiceAtom, null);
            setItems([]);
            setNext(null);
          }
        }}
      >
        <PopoverTrigger render={<Button variant="ghost" size="sm" aria-label={t("presets")} />}>
          <span className="document-name">{name || t("untitled")}</span>
          <ChevronDown size={12} />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={9} className="saved-presets-popover">
          <div className="saved-heading">
            <PopoverTitle>{t("presets")}</PopoverTitle>
            <span>
              {total} {t("yours")}
            </span>
          </div>
          <div className="current-preset">
            <div className="current-preset-image">
              <ShaderPreview src={currentImage} colors={history.present.colors} />
            </div>
            <div>
              <span className="current-tag">
                {t("current")} {modified && `· ${t("modified")}`}
              </span>
              <Input
                aria-label={t("presetName")}
                value={name}
                maxLength={80}
                placeholder={t("untitled")}
                onFocus={() => store.set(previewChoiceAtom, null)}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
            </div>
          </div>
          <div className="preset-save-actions">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                void save();
              }}
            >
              {busy ? <LoaderCircle className="spin" /> : <Save />}
              {t("save")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                void save(true);
              }}
            >
              <Plus />
              {t("saveCopy")}
            </Button>
          </div>
          <Tabs defaultValue="saved" className="preset-library-tabs">
            <TabsList aria-label={t("presets")}>
              <TabsTrigger value="saved">{t("yours")}</TabsTrigger>
              <TabsTrigger value="templates">{t("templates")}</TabsTrigger>
            </TabsList>
            <TabsContent value="templates">
              <Templates />
            </TabsContent>
            <TabsContent value="saved">
              <ScrollArea
                className="saved-preset-scroll"
                viewportClassName="saved-preset-list"
                viewportRef={scroll}
                onPointerLeave={() => store.set(previewChoiceAtom, null)}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    store.set(previewChoiceAtom, null);
                }}
              >
                {items.map((preset) => (
                  <div className="saved-preset-item" key={preset.id}>
                    <button
                      className="saved-preset-row"
                      aria-label={`Preset ${preset.name}`}
                      aria-current={active?.id === preset.id && !modified ? "true" : undefined}
                      onClick={() => choose(preset)}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") store.set(previewChoiceAtom, preset);
                      }}
                      onFocus={() => store.set(previewChoiceAtom, preset)}
                    >
                      <ShaderPreview
                        src={preset.thumbnail}
                        colors={preset.config.colors}
                        className="saved-thumbnail"
                      />
                      <span>{preset.name}</span>
                      {active?.id === preset.id && !modified && <Check size={14} />}
                    </button>
                    <IconButton
                      label={`${t("deletePreset")} ${preset.name}`}
                      onClick={() => {
                        void removePreset(preset.id).then(
                          () => {
                            if (active?.id === preset.id) setActive(null);
                            void load();
                          },
                          () => store.set(notificationAtom, "storageError"),
                        );
                      }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                ))}
                {!items.length && <p className="preset-empty">{t("emptySaved")}</p>}
                <div ref={sentinel} className="preset-sentinel" />
                {next && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void load(next);
                    }}
                  >
                    {t("loadMore")}
                  </Button>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
      <span className="toolbar-divider" />
      <IconButton
        label={t("savePreset")}
        disabled={busy}
        onClick={() => {
          void save();
        }}
      >
        {busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}
      </IconButton>
    </div>
  );
}
