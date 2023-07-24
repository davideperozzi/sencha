const data = new Map<string, any>();
const store = {
  get: (key: string, value?: any) => data.has(key) ? data.get(key) : value,
  set: (key: string, value: any) => {
    data.set(key, value);

    return store;
  },
  put: (key: string, value: any) => {
    data.set(key, value);

    return value;
  },
};

export default store;
