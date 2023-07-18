export function isDevelopment() {
  return ['dev', 'development'].includes(Deno.env.get('SENCHA_ENV') || '');
}
