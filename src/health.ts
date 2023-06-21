import { default as defaultLogger } from './logger';
import { delay } from './utils/promise';

export interface HealthCheck {
  url: string;
  method?: RequestInit['method'];
  timeout?: number;
  tries?: number;
  delay?: number;
  code?: number;
}

const logger = defaultLogger.child('health');

export async function healthCheck(
  checks: (HealthCheck | string)[],
  exit = true
) {
  logger.debug(`check started`);

  for (const check of checks) {
    const result = await waitForCheck(
      typeof check === 'string' ? { url: check } : check
    );

    if ( ! result) {
      if (exit) {
        logger.fatal(`check failed`);
        process.exit(1);
      }

      return false;
    }
  }

  logger.debug(`check passed`);

  return true;
}

async function waitForCheck(check: HealthCheck) {
  const {
    url,
    tries = 10,
    code = 200,
    timeout = 500,
    delay: delayMs = 3000,
    method = 'GET'
  } = check;

  for (let i = 0; i < tries; i++) {
    try {
      let resp: Response | null = null;
      const signal = AbortSignal.timeout(timeout);
      const request = fetch(url, { method, signal }).then(r => resp = r);

      // since abort signal is suported, just ignore
      // the request after a timeout
      await Promise.race([ request, delay(timeout) ]);

      if (resp !== null) {
        resp = resp as Response;

        logger.debug(`check ${url} (${resp.status})`);

        if (resp.status === code) {
          return true;
        }
      }
    } catch (error) {
      logger.error(`check ${url} failed: ` + (error as any).message);
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return false;
}
