import { default as defaultLogger } from '#logger';
import { delay } from '#utils';

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
        Deno.exit(1);
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
    timeout: timeoutMs = 500,
    delay: delayMs = 3000,
    method = 'GET'
  } = check;

  for (let i = 0; i < tries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { method, signal: controller.signal });

      logger.debug(`check ${url} (${response.status})`);

      clearTimeout(timeout);

      if (response.body) {
        await response.body.cancel();
      }

      if (response.status === code) {
        return true;
      }
    } catch (error) {
      logger.error(`check ${url} failed: ` + (error as any).message);
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return false;
}
