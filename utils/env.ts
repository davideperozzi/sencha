export function isDevelopment() {
  return ['dev', 'development'].includes(Bun.env.SENCHA_ENV || '');
}
