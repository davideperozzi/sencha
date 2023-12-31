export function safeCompare(a: string, b: string) {
  const strA = String(a);
  let strB = String(b);
  const lenA = strA.length;
  let result = 0;

  if (lenA !== strB.length) {
    strB = strA;
    result = 1;
  }

  for (let i = 0; i < lenA; i++) {
    result |= (strA.charCodeAt(i) ^ strB.charCodeAt(i));
  }

  return result === 0;
}
