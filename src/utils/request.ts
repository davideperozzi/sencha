export function isGetRequest(init?: FetchRequestInit) {
  return init?.method ? init.method.toLowerCase() === 'get' : true;
}
