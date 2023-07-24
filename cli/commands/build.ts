import { Command, CommandOptions } from '../command.ts';
import { Sencha } from '#core';

export interface BuildCommandOptions extends CommandOptions {}

export class BuildCommand extends Command<BuildCommandOptions> {
  public static command = 'build';
  public static description = 'execute sencha build once';

  public async run() {
    const sencha = new Sencha();

    await sencha.start();
    await sencha.build();
  }
}
