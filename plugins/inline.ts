import { Sencha, type SenchaPlugin } from '../core';
import { fileRead, fileWrite } from '../utils';
import { cpus } from 'node:os';

export interface InlineConfig {
  parallel?: number;
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }

  return v;
}

function extractAttrPath(tag: string, attr: "href" | "src"): string | null {
  let m = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, "i").exec(tag);

  if (m) {
    return m[1].trim()
  }

  m = new RegExp(`${attr}\\s*=\\s*'([^']+)'`, "i").exec(tag);

  if (m) {
    return m[1].trim()
  }

  m = new RegExp(`${attr}\\s*=\\s*\\{([^}]+)\\}`, "i").exec(tag);

  if (m) {
    return stripQuotes(m[1].trim())
  }

  m = new RegExp(`${attr}\\s*=\\s*([^\\s>]+)`, "i").exec(tag);

  if (m) {
    return stripQuotes(m[1].trim());
  }

  return null;
}

async function inlineLinks(html: string, sencha: Sencha): Promise<string> {
  const linkRe = /<link\b[^>]*\bdata-sencha-inline\b[^>]*>/gi;
  const matches = Array.from(html.matchAll(linkRe));

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const fullTag = m[0];
    const start = m.index!;
    const end = start + fullTag.length;

    const href = extractAttrPath(fullTag, "href");

    if (!href) {
      continue;
    }

    const css = await fileRead(sencha.outPath(href));
    const styleTag = `<style>\n${css}\n</style>`;

    html = html.slice(0, start) + styleTag + html.slice(end);
  }

  return html;
}

async function inlineScripts(html: string, sencha: Sencha): Promise<string> {
  const scriptRe = /<script\b[^>]*\bdata-sencha-inline\b[^>]*>(?:\s*<\/script>)?/gi;
  const matches = Array.from(html.matchAll(scriptRe));

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const fullTag = m[0];
    const start = m.index!;
    const end = start + fullTag.length;

    const src = extractAttrPath(fullTag, "src");

    if (!src) {
      continue;
    }

    const js = await fileRead(sencha.outPath(src));
    const scriptTag = `<script>\n${js}\n</script>`;

    html = html.slice(0, start) + scriptTag + html.slice(end);
  }

  return html;
}

export default (config: InlineConfig = {}) => {
  return (sencha: Sencha) => {
    const logger = sencha.logger.child('inliner');

    return {
      hooks: {
        buildSuccess: async ({ routes }) => {
          const start = performance.now();
          const cores = cpus?.length ?? 8;
          const parallel = config.parallel || Math.min(32, Math.max(4, cores * 3));
          let count = 0;

          for (let j = 0; j < routes.length; j += parallel) {
            const batch = routes.slice(j, j + parallel);

            await Promise.all(
              batch.map(async (route) => {
                try {
                  const view = sencha.outPath(`${route}/index.html`);
                  let html = await fileRead(view);

                  html = await inlineLinks(html, sencha);
                  html = await inlineScripts(html, sencha);

                  await fileWrite(view, html);

                  count++;
                } catch (err) {
                  logger.error(`failed to process ${route}: ` + err);
                }
              })
            );
          }

          logger.info(`processed ${count} views in ${(performance.now() - start).toFixed(2)}ms`);
        }
      }
    } as SenchaPlugin;
  };
};
