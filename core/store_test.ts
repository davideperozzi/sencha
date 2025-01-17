import store from './store.ts';
import { test, expect } from 'bun:test';

test('store', () => {
  expect(store.get('undefinedvalue')).toBe(undefined);
  expect(store.get('undefinedvalue', 'default')).toBe('default');
  expect(store.set('custom', 'value')).toBe(store);
  expect(store.put('custom', 'value')).toBe('value');
  expect(store.get('custom')).toBe('value' as any);
});
