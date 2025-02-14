import { createContext, use } from "react";
import { Route, RouteContext, SenchaContext } from "./";

export interface SenchaReactLayoutProps {
  children: React.ReactNode;
}

export const SenchaCtx = createContext<SenchaContext>({} as SenchaContext);
export const RouteCtx = createContext<Route>({} as Route);
export const I18nCtx = createContext<NonNullable<RouteContext["i18n"]>>({} as any);
export const ViewPropsCtx = createContext<any>({});

export const useSencha = () => use(SenchaCtx); 
export const useRoute = <T = Record<string, unknown>>() => use(RouteCtx) as Route<T>; 
export const useI18n = () => use(I18nCtx); 
export const useViewProps = <T>() => use<T>(ViewPropsCtx); 

export function useLink(route?: Route, i18n?: RouteContext["i18n"], sencha?: SenchaContext) {
  route = route || useRoute();
  const { t } = i18n || useI18n();
  const { config: { locale, route: { hideDefaultLang } } } = sencha || useSencha();

  const defaultLang = Array.isArray(locale) ? locale[0] : locale;
  const prefix = hideDefaultLang && defaultLang == route.lang ? '' : route?.lang + '/';

  const getPath = (slug: string) => `/${prefix}${(slug == "/" || slug == "") ? "" : slug}`;
  const getUrl = (view: string, repl: Record<string, string> = {}, host?: string) => {
    let url = getPath(t(`slugs.${view}`));

    for (const key in repl) {
      url = url.replaceAll(`[${key}]`, repl[key]);
    }

    if (host) {
      url = host + url;
    }

    return url;
  };

  return { getUrl };
}
