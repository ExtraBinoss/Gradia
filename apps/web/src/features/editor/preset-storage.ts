import { parseConfig, type GradientPreset } from "@plinka/gradient-core";
import { thumbnail } from "./thumbnails";
export interface SavedGradient extends GradientPreset {
  thumbnail: string;
  createdAt: number;
  updatedAt: number;
}
export type PresetCursor = [number, string];
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("plinka-gradient-studio", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("presets", { keyPath: "id" });
      store.createIndex("order", ["updatedAt", "id"]);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
  }));
}
export async function putPreset(preset: SavedGradient) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    tx.objectStore("presets").put({ ...preset, config: parseConfig(preset.config) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function removePreset(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    tx.objectStore("presets").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function getPreset(id: string): Promise<SavedGradient | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("presets").objectStore("presets").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readPresets(
  cursor: PresetCursor | null = null,
  limit = 20,
): Promise<{ items: SavedGradient[]; next: PresetCursor | null; total: number }> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets");
    const store = tx.objectStore("presets");
    const count = store.count();
    const request = store
      .index("order")
      .openCursor(cursor ? IDBKeyRange.upperBound(cursor, true) : null, "prev");
    const items: SavedGradient[] = [];
    let next: PresetCursor | null = null;
    request.onsuccess = () => {
      const entry = request.result;
      if (!entry) return;
      const raw = entry.value as SavedGradient;
      try {
        items.push({ ...raw, config: parseConfig(raw.config) });
      } catch {
        /* Ignore corrupt records without blocking the rest of the library. */
      }
      next = [raw.updatedAt, raw.id];
      if (items.length < limit) entry.continue();
    };
    tx.oncomplete = () =>
      resolve({ items, next: items.length === limit ? next : null, total: count.result });
    tx.onerror = () => reject(tx.error);
  });
}
let migration: Promise<void> | undefined;
export function migrateLegacyPresets() {
  return (migration ??= (async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(localStorage.getItem("gradient-presets") || "[]");
    } catch {
      return;
    }
    if (!Array.isArray(raw) || !raw.length) return;
    for (const item of raw) {
      let config;
      try {
        config = parseConfig(item.config);
      } catch {
        continue;
      }
      const id = typeof item.id === "string" ? item.id : crypto.randomUUID();
      if (await getPreset(id)) continue;
      await putPreset({
        id,
        name: typeof item.name === "string" ? item.name.slice(0, 80) : "Preset",
        config,
        thumbnail: await thumbnail(config),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        custom: true,
      });
    }
    try {
      localStorage.removeItem("gradient-presets");
    } catch {
      /* Optional cleanup. */
    }
  })());
}
