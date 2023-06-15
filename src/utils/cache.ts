export function buildCacheKey(vars: Record<string, any>) {
  return Object.keys(vars)
    .sort()
    .map(key => `${key}::${JSON.stringify(vars[key])}`)
    .join('|');
}
