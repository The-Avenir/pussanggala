/** Native consumers receive file:/// URIs, never a remote/relative resource. */
export function isLocalFileUri(value: string): boolean {
  if (!/^file:\/\/\/[^/?#\u0000-\u0020\\][^?#\u0000-\u0020\\]*$/.test(value) || /%(?:2f|5c|00)/i.test(value)) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(value.slice(8)); } catch { return false; }
  return !decoded.includes("%") && !decoded.includes("\\")
    && !/[\u0000-\u001f]/.test(decoded)
    && decoded.split("/").every(part => part !== "." && part !== "..");
}
export function joinAssetPath(baseDir: string, bundlePath: string): string {
  return `${baseDir.replace(/\/$/, "")}/${bundlePath}`;
}
