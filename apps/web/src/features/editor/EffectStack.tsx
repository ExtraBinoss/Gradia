import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { selectAtom } from "jotai/utils";
import { useTranslation } from "react-i18next";
import { animate, useReducedMotion } from "motion/react";
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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  LockKeyhole,
  Plus,
  RotateCcw,
  Trash2,
  Palette,
  Type,
  Grid2X2,
  Columns3,
  Waves,
} from "lucide-react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import {
  blendModes,
  compositeModes,
  effectFields,
  effectTypes,
  MAX_EFFECTS,
  type EffectField,
  type EffectType,
  type History,
} from "@plinka/gradient-core";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger, PopoverTitle } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Choice, IconButton } from "./control-primitives";
import { configAtom, previewAtom, commitAtom, historyAtom } from "./state";
import {
  addEffectAtom,
  duplicateEffectAtom,
  effectOrderAtom,
  patchEffectAtom,
  removeEffectAtom,
  reorderEffectsAtom,
  selectedEffectIdAtom,
  selectedEffectTypeAtom,
  type EffectEdit,
} from "./effect-state";
import { useScrollShadows } from "./use-scroll-shadows";

type FieldValue = number | string | boolean;
function useEffectValue(id: string, field: string, fallback: FieldValue) {
  const selected = useMemo(
    () =>
      atom((get) => {
        const effect = get(configAtom).effects.find((item) => item.id === id);
        if (!effect) return fallback;
        return field.startsWith("$")
          ? ((effect as unknown as Record<string, FieldValue>)[field.slice(1)] ?? fallback)
          : ((effect.params as unknown as Record<string, FieldValue>)[field] ?? fallback);
      }),
    [id, field, fallback],
  );
  return useAtomValue(selected);
}
function useEffectEdit(id: string) {
  const store = useStore();
  return useMemo(
    () => ({
      change: (field: string, value: FieldValue, preview = false) => {
        const patch: EffectEdit = { id, preview };
        if (field.startsWith("$"))
          patch.changes = { [field.slice(1)]: value } as EffectEdit["changes"];
        else patch.parameters = { [field]: value };
        store.set(patchEffectAtom, patch);
      },
      finish: () => {
        const preview = store.get(previewAtom);
        if (preview) store.set(commitAtom, preview);
      },
      cancel: () => store.set(previewAtom, null),
    }),
    [store, id],
  );
}
function EffectIcon({ type }: { type: EffectType | "gradient" }) {
  if (type === "gradient") return <Palette size={15} />;
  if (type === "ascii") return <Type size={15} />;
  if (type === "blocks") return <Grid2X2 size={15} />;
  if (type === "glass") return <Columns3 size={15} />;
  if (type === "folds") return <Waves size={15} />;
  return <span className="dither-icon" aria-hidden="true" />;
}
const EffectNumber = memo(function EffectNumber({
  id,
  field,
  definition,
  label,
}: {
  id: string;
  field: string;
  definition: Extract<EffectField, { kind: "number" }>;
  label: string;
}) {
  const { t } = useTranslation();
  const value = Number(useEffectValue(id, field, definition.default));
  const edit = useEffectEdit(id),
    store = useStore(),
    reduced = useReducedMotion();
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false),
    animation = useRef<ReturnType<typeof animate> | null>(null);
  const resetHistory = useRef<History | null>(null),
    labelId = useId();
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
          animation.current.stop();
          animation.current = null;
          store.set(previewAtom, null);
        }
      }),
    [store],
  );
  const reset = () => {
    stop();
    edit.change(field, definition.default);
    if (reduced || value === definition.default) return;
    resetHistory.current = store.get(historyAtom);
    edit.change(field, value, true);
    animation.current = animate(value, definition.default, {
      duration: 0.24,
      ease: [0.2, 0.75, 0.25, 1],
      onUpdate: (n) => edit.change(field, n, true),
      onComplete: () => {
        animation.current = null;
        resetHistory.current = null;
        edit.finish();
      },
    });
  };
  return (
    <div className="number-control">
      <div className="control-label">
        <label id={labelId} title={t("doubleReset")} onDoubleClick={reset}>
          {label}
        </label>
        <div className="number-value">
          <input
            aria-label={`${label} — ${t("settings")}`}
            inputMode="decimal"
            value={draft ?? Number(value.toFixed(definition.step < 0.01 ? 3 : 2)).toString()}
            onChange={(event) => {
              stop();
              setDraft(event.target.value);
            }}
            onBlur={() => {
              if (!cancelled.current && draft !== null && draft.trim()) {
                const next = Number(draft.replace(",", "."));
                if (Number.isFinite(next)) edit.change(field, next);
              }
              cancelled.current = false;
              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                cancelled.current = true;
                setDraft(null);
                event.currentTarget.blur();
              }
            }}
          />
          <IconButton className="reset-value" label={`${t("reset")} ${label}`} onClick={reset}>
            <RotateCcw size={11} />
          </IconButton>
        </div>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={definition.min}
        max={definition.max}
        step={definition.step}
        value={[value]}
        onPointerDownCapture={stop}
        onKeyDownCapture={stop}
        onValueChange={(next) => {
          stop();
          edit.change(field, Array.isArray(next) ? next[0] : next, true);
        }}
        onValueCommitted={edit.finish}
        onKeyDown={(event) => {
          if (event.key === "Escape") edit.cancel();
        }}
      />
    </div>
  );
});
function EffectFieldControl({
  id,
  field,
  definition,
}: {
  id: string;
  field: string;
  definition: EffectField;
}) {
  const { t } = useTranslation();
  if (definition.kind === "number")
    return (
      <EffectNumber id={id} field={field} definition={definition} label={t(`fxParam_${field}`)} />
    );
  return <EffectOtherField id={id} field={field} definition={definition} />;
}
function EffectOtherField({
  id,
  field,
  definition,
}: {
  id: string;
  field: string;
  definition: Exclude<EffectField, { kind: "number" }>;
}) {
  const { t } = useTranslation();
  const value = useEffectValue(id, field, definition.default),
    edit = useEffectEdit(id),
    labelId = useId();
  const [draft, setDraft] = useState<string | null>(null),
    cancelled = useRef(false);
  const label = t(`fxParam_${field}`);
  if (definition.kind === "boolean")
    return (
      <div className="switch-row">
        <label htmlFor={labelId}>{label}</label>
        <Switch
          id={labelId}
          size="sm"
          checked={Boolean(value)}
          onCheckedChange={(next) => edit.change(field, next)}
        />
      </div>
    );
  if (definition.kind === "select")
    return (
      <div className="select-row">
        <label>{label}</label>
        <Choice
          label={label}
          value={String(value)}
          onChange={(next) => edit.change(field, next)}
          items={definition.options.map((option) => ({
            value: option,
            label:
              option === "bayer4" ? "Bayer 4×4" : option === "bayer8" ? "Bayer 8×8" : t("noise"),
          }))}
        />
      </div>
    );
  if (definition.kind === "color")
    return (
      <div className="switch-row">
        <span>{label}</span>
        <Popover
          onOpenChange={(open, details) => {
            if (!open) {
              if (details.reason === "escape-key") edit.cancel();
              else edit.finish();
            }
          }}
        >
          <PopoverTrigger
            className="mini-color"
            aria-label={label}
            style={{ background: String(value) }}
          />
          <PopoverContent className="color-popover">
            <HexColorPicker
              color={String(value)}
              onChange={(color) => edit.change(field, color, true)}
            />
            <HexColorInput
              aria-label={label}
              color={String(value)}
              prefixed
              onChange={(raw) => {
                const color = `#${raw.replace("#", "")}`;
                if (/^#[\da-f]{6}$/i.test(color)) edit.change(field, color, true);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  return (
    <label className="text-label">
      <span
        onDoubleClick={() => {
          setDraft(null);
          edit.change(field, definition.default);
        }}
        title={t("doubleReset")}
      >
        {label}
      </span>
      <input
        className="text-input mono"
        aria-label={label}
        maxLength={32}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.value.length >= 2 && /^[\x20-\x7e]+$/.test(event.target.value))
            edit.change(field, event.target.value, true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelled.current = true;
            edit.cancel();
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          if (!cancelled.current && draft !== null) {
            if (draft.length >= 2 && /^[\x20-\x7e]+$/.test(draft)) edit.change(field, draft);
            else edit.cancel();
          }
          cancelled.current = false;
          setDraft(null);
        }}
      />
    </label>
  );
}
function EffectChoices({ id }: { id: string }) {
  const { t } = useTranslation(),
    edit = useEffectEdit(id);
  const blend = String(useEffectValue(id, "$blendMode", "normal"));
  const composite = String(useEffectValue(id, "$composite", "source-over"));
  const scale = String(useEffectValue(id, "$scaleMode", "relative"));
  return (
    <>
      <div className="select-row">
        <span>{t("fxBlendMode")}</span>
        <Choice
          label={t("fxBlendMode")}
          value={blend}
          onChange={(value) => edit.change("$blendMode", value)}
          items={blendModes.map((value) => ({ value, label: t(`fxBlend.${value}`) }))}
        />
      </div>
      <div className="select-row">
        <span>{t("fxComposition")}</span>
        <Choice
          label={t("fxComposition")}
          value={composite}
          onChange={(value) => edit.change("$composite", value)}
          items={compositeModes.map((value) => ({ value, label: t(`fxComposite.${value}`) }))}
        />
      </div>
      <div className="select-row">
        <span>{t("fxScaleMode")}</span>
        <Choice
          label={t("fxScaleMode")}
          value={scale}
          onChange={(value) => edit.change("$scaleMode", value)}
          items={[
            { value: "relative", label: t("fxRelative") },
            { value: "pixels", label: t("fxPixels") },
          ]}
        />
      </div>
    </>
  );
}
export function SelectedEffectControls() {
  const id = useAtomValue(selectedEffectIdAtom),
    type = useAtomValue(selectedEffectTypeAtom);
  const { t } = useTranslation();
  const colored = Boolean(useEffectValue(id, "colored", true)),
    monochrome = Boolean(useEffectValue(id, "monochrome", false));
  if (type === "gradient") return null;
  return (
    <div className="selected-effect-controls" data-effect-settings={type}>
      <section className="control-section fx-mixing-section">
        <Collapsible className="fx-composition-options">
          <CollapsibleTrigger className="advanced-trigger">
            {t("fxCompositingOptions")}
            <ChevronDown size={13} />
          </CollapsibleTrigger>
          <CollapsibleContent className="advanced-content">
            <EffectNumber
              id={id}
              field="$opacity"
              definition={{ kind: "number", default: 1, min: 0, max: 1, step: 0.01 }}
              label={t("fxOpacity")}
            />
            <EffectChoices id={id} />
          </CollapsibleContent>
        </Collapsible>
      </section>
      <section className="control-section fx-parameters-section">
        {Object.entries(effectFields[type])
          .filter(
            ([field]) =>
              !(
                field === "foreground" &&
                ((type === "ascii" && colored) || (type === "dither" && !monochrome))
              ) && !(field === "background" && type === "dither" && !monochrome),
          )
          .map(([field, definition]) => (
            <EffectFieldControl key={field} id={id} field={field} definition={definition} />
          ))}
      </section>
    </div>
  );
}
const EffectRow = memo(function EffectRow({ id, index }: { id: string; index: number }) {
  const { t } = useTranslation(),
    store = useStore();
  const metadata = useMemo(
    () =>
      selectAtom(
        configAtom,
        (config) => {
          const effect = config.effects.find((item) => item.id === id);
          return effect
            ? { type: effect.type, enabled: effect.enabled, blendMode: effect.blendMode }
            : null;
        },
        (a, b) => a?.type === b?.type && a?.enabled === b?.enabled && a?.blendMode === b?.blendMode,
      ),
    [id],
  );
  const effect = useAtomValue(metadata),
    selected = useAtomValue(selectedEffectIdAtom);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  if (!effect) return null;
  const name = t(`fx_${effect.type}`);
  return (
    <div
      ref={setNodeRef}
      className="effect-row"
      data-testid={`effect-row-${id}`}
      data-effect-type={effect.type}
      data-selected={selected === id}
      data-enabled={effect.enabled}
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        className="effect-grip"
        {...attributes}
        {...listeners}
        aria-label={`${t("fxMove")} ${name} ${index + 1}`}
      >
        <GripVertical size={13} />
      </button>
      <button
        className="effect-select"
        aria-label={`${t("fxSelect")} ${name}`}
        aria-pressed={selected === id}
        onClick={() => store.set(selectedEffectIdAtom, id)}
      >
        <span className="effect-icon">
          <EffectIcon type={effect.type} />
        </span>
        <span>
          <strong>{name}</strong>
          <small>{t(`fxBlend.${effect.blendMode}`)}</small>
        </span>
      </button>
      <IconButton
        label={`${effect.enabled ? t("fxHide") : t("fxShow")} ${name}`}
        aria-pressed={effect.enabled}
        onClick={() => store.set(patchEffectAtom, { id, changes: { enabled: !effect.enabled } })}
      >
        {effect.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
      </IconButton>
      <IconButton
        label={`${t("fxRemove")} ${name}`}
        onClick={() => store.set(removeEffectAtom, id)}
      >
        <Trash2 size={13} />
      </IconButton>
    </div>
  );
});
export function EffectStack() {
  const { t } = useTranslation(),
    store = useStore(),
    ids = useAtomValue(effectOrderAtom),
    selected = useAtomValue(selectedEffectIdAtom);
  const add = useSetAtom(addEffectAtom),
    duplicate = useSetAtom(duplicateEffectAtom);
  const [open, setOpen] = useState(false);
  const scroll = useScrollShadows();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <section className="effects-panel glass" data-testid="effect-stack" aria-label={t("fxEffects")}>
      <div className="effects-panel-heading">
        <Layers size={15} />
        <h2>{t("fxEffects")}</h2>
        <span className="effects-count">{ids.length + 1}</span>
        {selected !== "gradient" && (
          <IconButton
            label={t("fxDuplicate")}
            disabled={ids.length >= MAX_EFFECTS}
            onClick={() => duplicate(selected)}
          >
            <Copy size={13} />
          </IconButton>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("fxAdd")}
                disabled={ids.length >= MAX_EFFECTS}
              />
            }
          >
            <Plus size={16} />
          </PopoverTrigger>
          <PopoverContent className="effects-add-popover" side="left" align="end">
            <PopoverTitle>{t("fxAdd")}</PopoverTitle>
            <div className="effects-add-options">
              {effectTypes.map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  className="effects-add-option"
                  aria-label={t(`fx_${type}`)}
                  onClick={() => {
                    add(type);
                    setOpen(false);
                  }}
                >
                  <span className="effect-icon">
                    <EffectIcon type={type} />
                  </span>
                  <span>
                    <strong>{t(`fx_${type}`)}</strong>
                    <small>{t(`fxDescription_${type}`)}</small>
                  </span>
                  <Plus size={13} />
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <ScrollArea
        className="effects-stack-scroll"
        viewportClassName="effects-stack-viewport"
        viewportRef={scroll}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) {
              const from = ids.indexOf(String(active.id)),
                to = ids.indexOf(String(over.id));
              if (from >= 0 && to >= 0) store.set(reorderEffectsAtom, arrayMove(ids, from, to));
            }
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="effect-list">
              {ids.map((id, index) => (
                <EffectRow key={id} id={id} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div
          className="effect-row effect-gradient-row"
          data-testid="effect-row-gradient"
          data-effect-type="gradient"
          data-selected={selected === "gradient"}
        >
          <span className="effect-base-spacer" />
          <button
            className="effect-select"
            aria-label={`${t("fxSelect")} ${t("gradient")}`}
            aria-pressed={selected === "gradient"}
            onClick={() => store.set(selectedEffectIdAtom, "gradient")}
          >
            <span className="effect-icon">
              <EffectIcon type="gradient" />
            </span>
            <span>
              <strong>{t("gradient")}</strong>
              <small>{t("fxSource")}</small>
            </span>
          </button>
          <span className="effect-source-lock" title={t("fxSource")}>
            <LockKeyhole size={12} />
          </span>
        </div>
      </ScrollArea>
      <p className="effects-order-hint">{t("fxOrderHint")}</p>
    </section>
  );
}
