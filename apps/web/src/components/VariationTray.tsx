import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronUp, Dice5 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useScrollShadows } from "@/features/editor/use-scroll-shadows";
interface Props<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  getLabel: (item: T, index: number) => string;
  renderPreview: (item: T) => ReactNode;
  onPreview: (item: T | null) => void;
  onApply: (item: T) => void;
  onOpen: () => void;
  onRefresh: () => void;
  label: string;
  refreshLabel: string;
  selectedKey?: string;
  busy?: boolean;
}
export function VariationTray<T>({
  items,
  getKey,
  getLabel,
  renderPreview,
  onPreview,
  onApply,
  onOpen,
  onRefresh,
  label,
  refreshLabel,
  selectedKey,
  busy,
}: Props<T>) {
  const [expanded, setExpanded] = useState(false),
    [roll, setRoll] = useState(0);
  const host = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroll = useScrollShadows("horizontal", expanded);
  const hold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const open = () => {
    hold();
    if (!expanded) {
      setExpanded(true);
      onOpen();
    }
  };
  const close = () => {
    hold();
    setExpanded(false);
    onPreview(null);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!expanded) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !host.current?.contains(e.target)) {
        setExpanded(false);
        onPreview(null);
      }
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [expanded, onPreview]);
  return (
    <section
      className="variations-dock"
      ref={host}
      aria-label={label}
      onPointerEnter={hold}
      onPointerLeave={() => {
        hold();
        timer.current = setTimeout(() => {
          if (!host.current?.contains(document.activeElement)) close();
        }, 160);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      {expanded && <span className="variation-bridge" aria-hidden="true" />}
      <AnimatePresence initial={false}>
        {expanded && (
          <m.div
            className="variations-tray glass generated-tray"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            <ScrollArea
              className="variation-scroll-root"
              viewportClassName="variation-scroll scroll-shadow-x"
              viewportRef={scroll}
              orientation="horizontal"
            >
              <div className="variation-grid" aria-busy={busy}>
                <AnimatePresence initial={false} mode="popLayout">
                  {items.length
                    ? items.map((item, index) => (
                        <m.button
                          key={index}
                          data-variation-id={getKey(item)}
                          layout
                          className={`variation-card ${selectedKey === getKey(item) ? "selected" : ""}`}
                          aria-label={getLabel(item, index)}
                          initial={{ opacity: 0, y: 9 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.22 }}
                          onPointerEnter={(e) => {
                            if (e.pointerType === "mouse") onPreview(item);
                          }}
                          onFocus={() => onPreview(item)}
                          onClick={() => onApply(item)}
                        >
                          <div className="variation-preview">{renderPreview(item)}</div>
                          <span className="variation-caption">
                            <span>{getLabel(item, index)}</span>
                            <span className="mono">{String(index + 1).padStart(2, "0")}</span>
                          </span>
                        </m.button>
                      ))
                    : Array.from({ length: 4 }, (_, index) => (
                        <div className="variation-card variation-placeholder" key={index} />
                      ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </m.div>
        )}
      </AnimatePresence>
      <div className="variations-pill glass">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") open();
          }}
          onClick={() => {
            if (expanded) close();
            else open();
          }}
        >
          {label}
          <m.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.22 }}>
            <ChevronUp size={13} />
          </m.span>
        </Button>
        <span className="toolbar-divider" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={refreshLabel}
                aria-disabled={busy}
              />
            }
            onClick={() => {
              if (busy) return;
              hold();
              setExpanded(true);
              setRoll((value) => value + 1);
              onRefresh();
            }}
          >
            <m.span
              animate={{ rotate: roll * 180 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <Dice5 size={16} />
            </m.span>
          </TooltipTrigger>
          <TooltipContent>{refreshLabel}</TooltipContent>
        </Tooltip>
      </div>
    </section>
  );
}
