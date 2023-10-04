const data = new Map<string, unknown>();
const store = { get, set, put };

function get<T = unknown>(key: string): T | undefined;
function get<T = unknown>(key: string, value: T): T;
function get<T = unknown>(key: string, value?: T): T | undefined {
    return data.has(key) ? data.get(key) as T : value;
}

function set<T = unknown>(key: string, value: T) {
  data.set(key, value);

  return store;
}

function put<T = unknown>(key: string, value: T) {
  data.set(key, value);

  return value;
}

export default store;
