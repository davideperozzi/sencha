import { Logger } from '../logger';

export const measure = (logger: Logger) => {
  const measures = new Map<string, number>();

  return {
    start: (name: string, msg?: string) => {
      measures.set(name, performance.now());

      if (msg) {
        logger.debug(msg);
      }
    },
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
