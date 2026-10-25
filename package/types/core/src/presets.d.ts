import { type GradientConfig } from "./config";
export interface GradientPreset {
    id: string;
    name: string;
    config: GradientConfig;
    custom?: boolean;
}
export declare const presets: GradientPreset[];
