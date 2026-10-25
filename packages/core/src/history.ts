import type { GradientConfig } from "./config";
export interface History {
  past: GradientConfig[];
  present: GradientConfig;
  future: GradientConfig[];
}
export function commit(history: History, config: GradientConfig): History {
  if (JSON.stringify(history.present) === JSON.stringify(config)) return history;
  return { past: [...history.past.slice(-49), history.present], present: config, future: [] };
}
export function undo(history: History): History {
  const previous = history.past.at(-1);
  return previous
    ? {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      }
    : history;
}
export function redo(history: History): History {
  const next = history.future[0];
  return next
    ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) }
    : history;
}
