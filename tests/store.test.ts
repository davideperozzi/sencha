import { expect, test } from 'bun:test';

import store from '../src/store';

test('store', () => {
  expect(store.get('undefinedvalue')).toBeUndefined();
  expect(store.get('undefinedvalue', 'default')).toBe('default');
  expect(store.set('custom', 'value')).toBe(store);
  expect(store.put('custom', 'value')).toBe('value');
  expect(store.get('custom')).toBe('value');
});
