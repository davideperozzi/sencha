#!/usr/bin/env bun

async function run() {
  while (true) {
    const command = Bun.spawn({
      cwd: process.cwd(),
      stdout: "inherit", 
      stderr: "inherit", 
      cmd: [
        Bun.env.BUN_PATH || "bun", 
        "run",
        import.meta.resolve("./cli/command.ts").replace('file://', ''),
        ...Bun.argv.slice(2), 
      ],
    });

    const code = await command.exited;

    // Code 243 is used to signal the parent process that it needs to restart.
    // This will mostly happen when the user is using the watcher and it has
    // detected a file change, that needs a restart.
    //
    // Since you can't clear the cache of dynamic imports in deno, we need to
    // workaround this by using child processes. This ensures that when the
    // user e.g. changes a config file, that has been dynamically imported
    // in the process, that the next build will use the new config file.
    // It also ensures that all dependencies of this config file are reloaded.
    if (code === 243) {
      continue;
    }

    process.exit(code);
  }
}

run();
