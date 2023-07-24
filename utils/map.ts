export class ArrayMap<K, V> extends Map<K, V[]> {
  push(key: K, value: V) {
    if (this.has(key)) {
      this.get(key)?.push(value);
    } else {
      this.set(key, [value]);
    }
  }
}
