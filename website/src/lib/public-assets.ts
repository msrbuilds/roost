declare const __ROOST_PUBLIC_ASSETS__: Record<string, string>;

export function publicAsset(path: string): string {
  const version = __ROOST_PUBLIC_ASSETS__[path];
  if (!version) throw new Error(`Missing public asset fingerprint: ${path}`);
  return `${path}?v=${version}`;
}
