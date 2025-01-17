export function isSearchEngineBot(userAgent?: string | null) {
  if (!userAgent) {
    return false;
  }

  return /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|msnbot|teoma|crawler|spider/i.test(userAgent);
};
