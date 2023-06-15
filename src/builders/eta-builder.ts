import path from 'node:path';

import { Builder } from '../builder';
import { Route } from '../route';
import { Eta } from './eta-runtime';

export class EtaBuilder extends Builder {
  private eta = new Eta({ views: this.config.rootDir });

  async compile(route: Route) {
    return await this.eta.renderAsync(
      path.relative(this.config.rootDir, route.file)
    );
  }
}
