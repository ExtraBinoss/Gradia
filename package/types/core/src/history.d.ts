import type { GradientConfig } from "./config";
export interface History {
    past: GradientConfig[];
    present: GradientConfig;
    future: GradientConfig[];
}
export declare function commit(history: History, config: GradientConfig): History;
export declare function undo(history: History): History;
export declare function redo(history: History): History;
