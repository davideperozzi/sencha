import { Command } from '../command.ts';
import { BuildCommand } from './build.ts';

export const commands: (typeof Command<any>)[] = [
  BuildCommand,
];
