// Projects live in this browser's IndexedDB. Nothing is uploaded.
import type { Style, Zoom } from "./render";

export type Project = {
  id: string;
  name: string;
  created: number;
  updated: number;
  duration: number;
  w: number;
  h: number;
  zooms: Zoom[];
  style: Style;
  source: "recording" | "import" | "example";
  analyzed: boolean;
};

const DB = "zoomies", VER = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("videos")) db.createObjectStore("videos");
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    let out: T | undefined;
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => { db.close(); res(out); };
    t.onerror = () => { db.close(); rej(t.error); };
    t.onabort = () => { db.close(); rej(t.error ?? new Error("Storage is full or blocked.")); };
  });
}

export const listProjects = async () => ((await tx<Project[]>("projects", "readonly", (s) => s.getAll())) ?? []).sort((a, b) => b.updated - a.updated);
export const saveProject = (p: Project) => tx("projects", "readwrite", (s) => s.put({ ...p, updated: Date.now() }));
export const getVideo = (id: string) => tx<Blob>("videos", "readonly", (s) => s.get(id));
export const saveVideo = (id: string, b: Blob) => tx("videos", "readwrite", (s) => s.put(b, id));
export const getImage = (id: string) => tx<Blob>("images", "readonly", (s) => s.get(id));
export const saveImage = (id: string, b: Blob) => tx("images", "readwrite", (s) => s.put(b, id));
export async function deleteProject(id: string) {
  await tx("projects", "readwrite", (s) => s.delete(id));
  await tx("videos", "readwrite", (s) => s.delete(id));
  await tx("images", "readwrite", (s) => s.delete(id));
}
