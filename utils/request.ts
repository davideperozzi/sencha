export function isGetRequest(init?: RequestInit) {
  return init?.method ? init.method.toLowerCase() === 'get' : true;
}
