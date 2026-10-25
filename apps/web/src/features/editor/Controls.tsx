import { useScrollShadows } from "./use-scroll-shadows";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useId, useState, useRef, useEffect, useMemo, memo } from "react";
import { useAtomValue, useStore, atom } from "jotai";
import { useTranslation } from "react-i18next";
import { HexColorPicker, HexColorInput } from "react-colorful";
import {
  Plus,
  RotateCcw,
  Trash2,
  ChevronDown,
  Palette,
  Waves,
  SlidersHorizontal,
} from "lucide-react";
import {
  DEFAULT_CONFIG,
  ranges,
  type GradientConfig,
  type NumericParameter,
  type History,
} from "@plinka/gradient-core";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { animate, useReducedMotion } from "motion/react";
import {
  configAtom,
  commitAtom,
  previewAtom,
  hoverAtom,
  historyAtom,
  parameterAtoms,
  effectAtom,
  shaderStyleAtom,
  colorOrderAtom,
  colorCountAtom,
  activeColorCountAtom,
  booleanAtoms,
  toneAtoms,
  effectSettingsAtom,
} from "./state";
import type { ReactNode } from "react";

export function IconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function Choice({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue>{items.find((i) => i.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem value={i.value} key={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function useEdit() {
  const store = useStore();
  return {
    preview: (patch: Partial<GradientConfig>) => {
      store.set(hoverAtom, null);
      store.set(previewAtom, {
        ...(store.get(previewAtom) ?? store.get(historyAtom).present),
        ...patch,
      });
    },
    commit: (patch: Partial<GradientConfig>) =>
      store.set(commitAtom, {
        ...(store.get(previewAtom) ?? store.get(historyAtom).present),
        ...patch,
      }),
    finish: () => {
      const p = store.get(previewAtom);
      if (p) store.set(commitAtom, p);
    },
    cancel: () => store.set(previewAtom, null),
  };
}
export const NumberControl = memo(function NumberControl({
  name,
  step = 0.1,
}: {
  name: NumericParameter;
  step?: number;
}) {
  const { t } = useTranslation();
  const value = useAtomValue(parameterAtoms[name]);
  const edit = useEdit();
  const store = useStore();
  const reduced = useReducedMotion();
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const resetHistory = useRef<History | null>(null);
  const stop = () => {
    animation.current?.stop();
    animation.current = null;
  };
  useEffect(
    () => () => {
      if (animation.current) {
        animation.current.stop();
        store.set(previewAtom, null);
      }
    },
    [store],
  );
  useEffect(
    () =>
      store.sub(historyAtom, () => {
        if (animation.current && resetHistory.current !== store.get(historyAtom)) {
          const control = animation.current;
          animation.current = null;
          control.stop();
          store.set(previewAtom, null);
        }
      }),
    [store],
  );
  const reset = () => {
    stop();
    if (reduced) {
      edit.commit({ [name]: DEFAULT_CONFIG[name] });
      return;
    }
    if (value === DEFAULT_CONFIG[name]) {
      edit.commit({ [name]: DEFAULT_CONFIG[name] });
      return;
    }
    edit.commit({ [name]: DEFAULT_CONFIG[name] });
    resetHistory.current = store.get(historyAtom);
    edit.preview({ [name]: value });
    animation.current = animate(value, DEFAULT_CONFIG[name], {
      duration: 0.24,
      ease: [0.2, 0.75, 0.25, 1],
      onUpdate: (n) => edit.preview({ [name]: n }),
      onComplete: () => {
        animation.current = null;
        resetHistory.current = null;
        edit.finish();
      },
    });
  };
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId(),
    [min, max] = ranges[name];
  const apply = (n: number) => {
    if (Number.isFinite(n)) edit.commit({ [name]: Math.max(min, Math.min(max, n)) });
  };
  return (
    <div className="number-control">
      <div className="control-label">
        <label id={id} onDoubleClick={reset} title={t("doubleReset")}>
          {t(name)}
        </label>
        <div className="number-value">
          <input
            aria-label={`${t(name)} — ${t("settings")}`}
            inputMode="decimal"
            value={draft ?? Number(value.toFixed(step < 0.01 ? 3 : 2)).toString()}
            onChange={(e) => {
              stop();
              setDraft(e.target.value);
            }}
            onBlur={() => {
              if (draft !== null && draft.trim()) apply(Number(draft));
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(null);
                e.currentTarget.blur();
              }
            }}
          />
          <IconButton className="reset-value" label={`${t("reset")} ${t(name)}`} onClick={reset}>
            <RotateCcw size={11} />
          </IconButton>
        </div>
      </div>
      <Slider
        aria-labelledby={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onPointerDownCapture={stop}
        onKeyDownCapture={stop}
        onValueChange={(v) => {
          stop();
          edit.preview({ [name]: Array.isArray(v) ? v[0] : v });
        }}
        onValueCommitted={() => edit.finish()}
        onKeyDown={(e) => {
          if (e.key === "Escape") edit.cancel();
        }}
      />
    </div>
  );
});
function BooleanControl({ name }: { name: "asciiColored" | "asciiInvert" | "ditherMonochrome" }) {
  const value = useAtomValue(booleanAtoms[name]);
  const edit = useEdit();
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="switch-row">
      <label htmlFor={id}>{t(name)}</label>
      <Switch
        id={id}
        size="sm"
        checked={value}
        onCheckedChange={(value) => edit.commit({ [name]: value })}
      />
    </div>
  );
}
function SimpleColor({ name }: { name: "asciiColor" | "backgroundColor" }) {
  const color = useAtomValue(toneAtoms[name]);
  const edit = useEdit();
  const { t } = useTranslation();
  return (
    <div className="switch-row">
      <span>{t(name)}</span>
      <Popover
        onOpenChange={(open, details) => {
          if (!open) {
            if (details.reason === "escape-key") edit.cancel();
            else edit.finish();
          }
        }}
      >
        <PopoverTrigger className="mini-color" aria-label={t(name)} style={{ background: color }} />
        <PopoverContent className="color-popover">
          <HexColorPicker color={color} onChange={(color) => edit.preview({ [name]: color })} />
          <HexColorInput
            aria-label={t(name)}
            color={color}
            onChange={(color) => edit.preview({ [name]: `#${color.replace("#", "")}` })}
            prefixed
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
function SortableColor({ id, children }: { id: string; children: ReactNode }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-color ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children}
      <button
        type="button"
        className="color-drag-handle"
        ref={setActivatorNodeRef}
        aria-label={`${t("reorderColor")} ${id}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={11} />
      </button>
    </div>
  );
}
function useColor(id: string) {
  const selected = useMemo(
    () => atom((get) => get(configAtom).colors.find((color) => color.id === id)),
    [id],
  );
  return useAtomValue(selected);
}
const PaletteColor = memo(function PaletteColor({ id, index }: { id: string; index: number }) {
  const c = useColor(id);
  const enabledCount = useAtomValue(activeColorCountAtom);
  const store = useStore();
  const edit = useEdit();
  const { t } = useTranslation();
  const config = { colors: store.get(configAtom).colors };
  if (!c) return null;
  const change = (
    _index: number,
    patch: Partial<GradientConfig["colors"][number]>,
    preview = false,
  ) => {
    const colors = store
      .get(configAtom)
      .colors.map((color) => (color.id === id ? { ...color, ...patch } : color));
    if (!colors.some((color) => color.enabled)) return;
    if (preview) edit.preview({ colors });
    else edit.commit({ colors });
  };
  return (
    <SortableColor id={c.id}>
      <Popover
        onOpenChange={(open, details) => {
          if (!open) {
            if (details.reason === "escape-key") edit.cancel();
            else edit.finish();
          }
        }}
      >
        <PopoverTrigger
          aria-label={`${t("colors")} ${index + 1} ${c.color}`}
          className={`palette-swatch ${!c.enabled ? "disabled-color" : ""}`}
          style={{ background: c.color }}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
        </PopoverTrigger>
        <PopoverContent className="color-popover">
          <HexColorPicker color={c.color} onChange={(color) => change(index, { color }, true)} />
          <HexColorInput
            color={c.color}
            aria-label={`${t("colors")} ${index + 1}`}
            onChange={(color) => change(index, { color: `#${color.replace("#", "")}` }, true)}
            prefixed
          />
          <div className="switch-row">
            <label htmlFor={`enabled-${c.id}`}>{t("enableColor")}</label>
            <Switch
              id={`enabled-${c.id}`}
              size="sm"
              checked={c.enabled}
              disabled={c.enabled && enabledCount === 1}
              onCheckedChange={(enabled) => change(index, { enabled })}
            />
          </div>
          <label className="control-label">
            {t("influence")} <span>{c.influence.toFixed(1)}</span>
          </label>
          <Slider
            aria-label={t("influence")}
            min={0}
            max={2}
            step={0.05}
            value={[c.influence]}
            onValueChange={(v) => change(index, { influence: Array.isArray(v) ? v[0] : v }, true)}
            onValueCommitted={() => edit.finish()}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={config.colors.length <= 2 || (c.enabled && enabledCount === 1)}
            onClick={() => edit.commit({ colors: config.colors.filter((_, i) => i !== index) })}
          >
            <Trash2 />
            {t("removeColor")}
          </Button>
        </PopoverContent>
      </Popover>
    </SortableColor>
  );
});
const PaletteHex = memo(function PaletteHex({ id }: { id: string }) {
  const c = useColor(id);
  return c ? <span>{c.color.slice(1).toUpperCase()}</span> : null;
});
function Colors() {
  const ids = useAtomValue(colorOrderAtom);
  const count = useAtomValue(colorCountAtom);
  const store = useStore();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const edit = useEdit();
  const { t } = useTranslation();
  return (
    <section className="control-section">
      <div className="section-heading">
        <h3>{t("colors")}</h3>
        <span className="subtle">{count} / 6</span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            const colors = store.get(configAtom).colors;
            edit.commit({
              colors: arrayMove(
                colors,
                colors.findIndex((c) => c.id === active.id),
                colors.findIndex((c) => c.id === over.id),
              ),
            });
          }
        }}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="palette-strip">
            {ids.map((id, index) => (
              <PaletteColor key={id} id={id} index={index} />
            ))}
            <IconButton
              className="add-color"
              label={t("addColor")}
              disabled={count >= 6}
              onClick={() =>
                edit.commit({
                  colors: [
                    ...store.get(configAtom).colors,
                    { id: crypto.randomUUID(), color: "#ffffff", enabled: true, influence: 1 },
                  ],
                })
              }
            >
              <Plus size={15} />
            </IconButton>
          </div>
        </SortableContext>
      </DndContext>
      <div className="palette-hex">
        {ids.map((id) => (
          <PaletteHex key={id} id={id} />
        ))}
      </div>
      <NumberControl name="colorBlending" />
      <NumberControl name="brightness" step={0.01} />
      <NumberControl name="saturation" step={0.01} />
      <NumberControl name="contrast" step={0.01} />
      <NumberControl name="hueShift" step={1} />
    </section>
  );
}
function EffectControls() {
  const { t } = useTranslation();
  const c = useAtomValue(effectSettingsAtom);
  const edit = useEdit();
  const [characters, setCharacters] = useState<string | null>(null);
  if (c.effect === "gradient") return null;
  return (
    <section className="control-section effect-settings">
      <h3>{t(c.effect)}</h3>
      {c.effect === "ascii" ? (
        <>
          <NumberControl name="asciiSize" step={1} />
          <label className="text-label">
            {t("asciiCharacters")}
            <input
              className="text-input mono"
              value={characters ?? c.asciiCharacters}
              maxLength={32}
              onChange={(e) => setCharacters(e.target.value)}
              onBlur={() => {
                if (characters && characters.length >= 2 && /^[\x20-\x7e]+$/.test(characters))
                  edit.commit({ asciiCharacters: characters });
                setCharacters(null);
              }}
            />
          </label>
          <BooleanControl name="asciiColored" />
          <BooleanControl name="asciiInvert" />
        </>
      ) : (
        <>
          <div className="select-row">
            <span>{t("ditherPattern")}</span>
            <Choice
              label={t("ditherPattern")}
              value={c.ditherPattern}
              onChange={(value) =>
                edit.commit({ ditherPattern: value as GradientConfig["ditherPattern"] })
              }
              items={[
                { value: "bayer4", label: "Bayer 4×4" },
                { value: "bayer8", label: "Bayer 8×8" },
                { value: "noise", label: t("noise") },
              ]}
            />
          </div>
          <NumberControl name="ditherSize" step={1} />
          <NumberControl name="ditherLevels" step={1} />
          <NumberControl name="ditherStrength" step={0.01} />
          <BooleanControl name="ditherMonochrome" />
        </>
      )}
      {(c.effect === "ascii" || c.ditherMonochrome) && (
        <>
          <SimpleColor name="asciiColor" />
          <SimpleColor name="backgroundColor" />
        </>
      )}
    </section>
  );
}
export function Settings() {
  const scroll = useScrollShadows();
  const { t } = useTranslation();
  const effect = useAtomValue(effectAtom),
    style = useAtomValue(shaderStyleAtom);
  const store = useStore();
  const apply = (patch: Partial<GradientConfig>) =>
    store.set(commitAtom, { ...store.get(configAtom), ...patch });
  return (
    <aside className="settings-panel">
      <div className="panel-heading">
        <SlidersHorizontal size={16} />
        <h2>{t("settings")}</h2>
      </div>
      <div className="style-select">
        <label>{t("shaderStyle")}</label>
        <Choice
          label={t("shaderStyle")}
          value={style}
          onChange={(style) => apply({ style: style as GradientConfig["style"] })}
          items={["mesh", "silk", "aurora", "liquid", "radial", "waves"].map((value) => ({
            value,
            label: t(value),
          }))}
        />
      </div>
      <Tabs
        value={effect}
        onValueChange={(value) => apply({ effect: value as GradientConfig["effect"] })}
        className="effect-tabs"
      >
        <TabsList aria-label={t("appearance")}>
          <TabsTrigger value="gradient">
            <Palette />
            {t("gradient")}
          </TabsTrigger>
          <TabsTrigger value="ascii">
            <span className="ascii-icon" aria-hidden="true">
              Aa
            </span>
            {t("ascii")}
          </TabsTrigger>
          <TabsTrigger value="dither">
            <span className="dither-icon" aria-hidden="true" />
            {t("dither")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <ScrollArea
        className="settings-scroll-root"
        viewportClassName="settings-scroll"
        viewportRef={scroll}
      >
        <EffectControls />
        <Colors />
        <section className="control-section">
          <div className="section-heading">
            <h3>
              <Waves size={15} />
              {t("motion")}
            </h3>
          </div>
          <NumberControl name="speed" step={1} />
          <NumberControl name="waveAmplitude" />
          <NumberControl name="flow" />
          <Collapsible>
            <CollapsibleTrigger className="advanced-trigger">
              {t("advanced")}
              <ChevronDown size={13} />
            </CollapsibleTrigger>
            <CollapsibleContent className="advanced-content">
              <NumberControl name="waveFrequencyX" />
              <NumberControl name="waveFrequencyY" />
              <NumberControl name="horizontalPressure" />
              <NumberControl name="verticalPressure" />
              <NumberControl name="centerX" step={0.01} />
              <NumberControl name="centerY" step={0.01} />
              <NumberControl name="stretch" step={0.01} />
              <NumberControl name="twist" step={0.01} />
              <NumberControl name="scale" />
              <NumberControl name="rotation" step={1} />
              <NumberControl name="seed" step={1} />
            </CollapsibleContent>
          </Collapsible>
        </section>
        <section className="control-section">
          <h3>{t("texture")}</h3>
          <NumberControl name="grain" step={0.01} />
          <NumberControl name="vignette" step={0.01} />
          <Collapsible>
            <CollapsibleTrigger className="advanced-trigger">
              {t("advanced")}
              <ChevronDown size={13} />
            </CollapsibleTrigger>
            <CollapsibleContent className="advanced-content">
              <NumberControl name="chromaticShift" step={0.001} />
              <NumberControl name="grainScale" />
              <NumberControl name="shadows" />
              <NumberControl name="highlights" />
            </CollapsibleContent>
          </Collapsible>
        </section>
      </ScrollArea>
    </aside>
  );
}
// Exported from the actual shadcn Base UI registry, kept separate from engine code.
export { Tabs, TabsList, TabsTrigger, TabsContent };
