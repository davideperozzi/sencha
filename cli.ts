while (true) {
  const command = new Deno.Command(Deno.execPath(), {
    stdout: 'inherit',
    stderr: 'inherit',
    args: [
      'run',
      '-A',
      '-q',
      '--unstable',
      import.meta.resolve('./cli/command.ts'),
      ...Deno.args
    ]
  });

  const process = command.spawn();
  const { code } = await process.output();

  if (code === 243) {
    continue;
  }

  Deno.exit(code);
}
