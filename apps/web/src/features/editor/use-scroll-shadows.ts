import { useEffect, useRef } from "react";
export function useScrollShadows(axis: "vertical" | "horizontal" = "vertical", enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let frame = 0;
    const measure = () => {
      el.dataset.overflowStart = String(el.scrollLeft > 1);
      el.dataset.overflowEnd = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
      el.dataset.overflowTop = String(el.scrollTop > 1);
      el.dataset.overflowBottom = String(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    };
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    const observeContent = () => {
      for (const child of el.children) observer.observe(child);
      schedule();
    };
    const mutation = new MutationObserver(observeContent);
    mutation.observe(el, { childList: true, subtree: true });
    observeContent();
    el.addEventListener("scroll", schedule, { passive: true });
    return () => {
      el.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      mutation.disconnect();
    };
  }, [axis, enabled]);
  return ref;
}
