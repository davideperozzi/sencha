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
