import { assertEquals } from "https://deno.land/std@0.194.0/testing/asserts.ts";

import store from './store.ts';

Deno.test('store', () => {
  assertEquals(store.get('undefinedvalue'), undefined);
  assertEquals(store.get('undefinedvalue', 'default'), 'default');
  assertEquals(store.set('custom', 'value'), store);
  assertEquals(store.put('custom', 'value'), 'value');
  assertEquals(store.get('custom'), 'value');
});
