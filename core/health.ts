import defaultLogger from '../logger';

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
  const start = performance.now();

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

  logger.debug(`check passed in ${(performance.now() - start).toFixed(2)}ms`);

  return true;
}

async function waitForCheck(check: HealthCheck) {
  const {
    url,
    tries = 10,
    code = 200,
    timeout: timeoutMs = 800,
    delay: delayMs = 3000,
    method = 'GET'
  } = check;

  for (let i = 0; i < tries; i++) {
    try {
      const start = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { method, signal: controller.signal });
      const timeMs = (performance.now() - start).toFixed(2);

      logger.debug(`check ${url} (${response.status}) in ${timeMs}ms`);

      clearTimeout(timeout);

      // if (response.body) {
      //   await response.body.cancel();
      // }

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
