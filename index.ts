#!/usr/bin/env bun

import { main } from './src/git_state.ts';

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
