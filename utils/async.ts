export async function batchPromise<T>(
  items: Array<T>,
  limit: number,
  fn: (item: T) => Promise<any>,
): Promise<any> {
  let results: T[] = [];

  for (let start = 0; start < items.length; start += limit) {
    const end = start + limit > items.length ? items.length : start + limit;
    const slice = await Promise.all(items.slice(start, end).map(fn));

    results = [ ...results, ...slice ];
  }

  return results;
}

export async function delay(duration = 0) {
  await new Promise((resolve) => setTimeout(resolve, duration));
}

export type OptPromise<
  T extends (...a: any) => any
> = ((...a: Parameters<T>) => Promise<ReturnType<T>>) | T;

export async function optPromise<T>(value: any | Promise<T>, ...args: any[]) {
  if (typeof value === 'function') {
    value = value(...args);
  }

  return value instanceof Promise ? await value as T : value as T;
}

export function throttle<T extends Array<unknown>>(
  fn: (...args: T) => void,
  wait: number
) {
  let isCalled = false;

  return (...args: T) => {
    if ( ! isCalled) {
      fn(...args);
      isCalled = true;
      setTimeout(() => isCalled = false, wait);
    }
  };
}

export function asyncThrottleQueue<T extends Array<unknown>, R = unknown>(
  fn: (...args: T) => Promise<R>,
  minWait = 0
) {
  let isCalled = false;

  return async (...args: T) => {
    if ( ! isCalled) {
      await fn(...args);
      isCalled = true;
      setTimeout(() => isCalled = false, minWait);
    }
  };
}
