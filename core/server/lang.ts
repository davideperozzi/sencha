export function parseAcceptLanguage(header: string): string[] {
  return header.split(",") 
    .map((lang: string) => {
      const code = lang.split(";")[0]; 

      return code ? code.trim() : '';
    }).filter(Boolean); 
}

export function getPreferredUserLang(
  request: Request,
  locales: string[],
  fallbackLang?: string
) {
  const cookie = request.headers.get('cookie');
  const languages = parseAcceptLanguage(request.headers.get('accept-language') || '');
  const savedLang = cookie?.split('; ')
    .find(row => row.startsWith('sencha_custom_locale='))
    ?.split('=')[1];

  if (savedLang) {
    return savedLang;
  }

  if (languages) {    
    for (const lang of languages) {
      const locale = lang.split('-')[0];

      if (locales.includes(locale)) {
        return locale;
      }
    }
  }

  return fallbackLang;
}
