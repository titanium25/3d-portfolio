/**
 * Prefix a public asset path with the Vite base URL.
 * In dev: base is "/explore/", so "/models/foo.glb" → "/explore/models/foo.glb"
 * This ensures assets resolve correctly when the app is mounted at a subpath.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function assetPath(path: string): string {
  // If path already starts with base, don't double-prefix
  if (path.startsWith(BASE)) return path;
  return `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
