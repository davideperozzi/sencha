export function removeTrailingSlash(req: Request) {
  const url = new URL(req.url);

  if (url.pathname.endsWith('/') && url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, "");

    return Response.redirect(url, 302);
  }
};
