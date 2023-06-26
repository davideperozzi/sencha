import { Logger } from '../logger/mod.ts';

export const measure = (logger: Logger) => {
  const measures = new Map<string, number>();

  return {
    start: (name: string) => measures.set(name, performance.now()),
    end: (name: string, msg?: string) => {
      const start = measures.get(name) || 0
      const end = performance.now() - start;

      if (msg) {
        logger.debug(`${msg} in ${end.toFixed(2)}ms`);
      }

      return end;
    }
  };
};
