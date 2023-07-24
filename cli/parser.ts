// @deno-types=npm:@types/yargs
import yargs, { Argv } from 'https://deno.land/x/yargs@v17.7.2-deno/deno.ts';

import { commands } from './commands/mod.ts';

export interface ParseArgs {
  cmd: string;
}

export async function parse() {
  let cli = yargs(Deno.args);

  commands.forEach(commandCtor => {
    cli = cli.command(
      commandCtor.command,
      commandCtor.desciption,
      (yargs: Argv) => yargs.options(commandCtor.allOptions).env(
        `SENCHA_${commandCtor.command.toUpperCase()}`
      )
    );
  });

  cli.demandCommand();

  const args = await cli.argv;

  return {
    cli,
    cmd: args._[0],
    ...args
  };
}
