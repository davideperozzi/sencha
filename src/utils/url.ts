export function cleanUrl(
  url: string,
  leading = true,
  trailing = false,
  removeExt = false
) {
  url = trimUrl(url.replace(/\/{2,}/g, '/'), leading, trailing);

  if (removeExt) {
    url = url.replace(/\.(.*?)$/, '');
  }

  return url || '/';
}

export function trimUrl(
  url: string,
  leading = false,
  trailing = false
) {
  return (leading ? '/' : '')
    + url.replace(/\/$/, '').replace(/^\//, '')
    + (trailing ? '/' : '');
}
