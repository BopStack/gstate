import { $ } from 'bun';

const USAGE = `Usage: gstate <command> [args] [--repo]

Commands:
  get <key>             Print the resolved value (branch before repository)
  set <key> <value>     Store a branch value by default
  unset <key>           Remove a branch value by default
  list                  List resolved values with their origin
  list-all              List raw repository and branch values
  rm                    Remove all values in the selected scope
  rename <new-branch>   Move the current branch state to a new branch name

Scope:
  --repo                Use repository scope instead of branch scope

Environment:
  GIT_STATE_BRANCH      Override the current branch for branch-scoped commands
`;

interface ConfigResult {
	readonly code: number;
	readonly stderr: string;
	readonly stdout: string;
}

interface ParsedCommand {
	readonly args: readonly string[];
	readonly command: string;
	readonly repo: boolean;
}

interface StateEntry {
	readonly key: string;
	readonly origin: 'branch' | 'repo';
	readonly value: string;
}

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)*$/;

function usage_error(message: string): never {
	process.stderr.write(`${message}\n\n${USAGE}`);
	process.exit(2);
}

function command_error(message: string, code = 1): never {
	process.stderr.write(`${message}\n`);
	process.exit(code);
}

function regex_escape(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validate_key(key: string): void {
	if (!KEY_PATTERN.test(key)) {
		usage_error(`Invalid key: ${key}. Keys must use Git config variable-name components.`);
	}
}

function parse_command(argv: readonly string[]): ParsedCommand {
	const [command, ...raw_args] = argv;
	if (!command || command === '--help' || command === '-h') {
		process.stdout.write(USAGE);
		process.exit(command ? 0 : 2);
	}

	let repo = false;
	const args: string[] = [];
	for (const arg of raw_args) {
		if (arg === '--repo') {
			if (repo) usage_error('Duplicate --repo flag.');
			repo = true;
			continue;
		}
		args.push(arg);
	}

	return { args, command, repo };
}

async function git_common_dir(): Promise<string> {
	try {
		return (await $`git rev-parse --path-format=absolute --git-common-dir`.text()).trim();
	} catch {
		command_error('Not inside a Git worktree.');
	}
}

async function current_branch(): Promise<string | null> {
	const override = process.env.GIT_STATE_BRANCH;
	if (override) return override;

	try {
		const branch = await $`git branch --show-current`.text();
		return branch.trim() || null;
	} catch {
		command_error('Not inside a Git worktree.');
	}
}

async function cfg_run(config_file: string, args: readonly string[]): Promise<ConfigResult> {
	const proc = Bun.spawn(['git', 'config', '--file', config_file, ...args], {
		stderr: 'pipe',
		stdout: 'pipe',
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code, stderr, stdout };
}

function report_git_failure(result: ConfigResult): never {
	const message = result.stderr.trim() || 'Git configuration command failed.';
	command_error(message, result.code || 1);
}

function branch_section(branch: string): string {
	return `state.${branch}`;
}

function repo_section(): string {
	return 'state.repo';
}

function parse_entries(stdout: string, section: string, origin: StateEntry['origin']): StateEntry[] {
	const prefix = `${section}.`;
	return stdout
		.split('\n')
		.filter(Boolean)
		.flatMap((line) => {
			const separator = line.indexOf(' ');
			if (separator < 0) return [];
			const full_key = line.slice(0, separator);
			if (!full_key.startsWith(prefix)) return [];
			return [{ key: full_key.slice(prefix.length), origin, value: line.slice(separator + 1) }];
		});
}

async function read_scope(config_file: string, section: string, origin: StateEntry['origin']): Promise<StateEntry[]> {
	const result = await cfg_run(config_file, ['--get-regexp', `^${regex_escape(section)}\\.`]);
	if (result.code === 1) return [];
	if (result.code !== 0) report_git_failure(result);
	return parse_entries(result.stdout, section, origin);
}

async function require_branch(): Promise<string> {
	const branch = await current_branch();
	if (!branch) command_error('Not on a branch; set GIT_STATE_BRANCH to override.');
	return branch;
}

function print_entries(entries: readonly StateEntry[], include_origin: boolean): void {
	for (const entry of entries) {
		process.stdout.write(
			include_origin
				? `${entry.key} ${entry.value} (${entry.origin})\n`
				: `${entry.origin} ${entry.key} ${entry.value}\n`,
		);
	}
}


async function get_command(config_file: string, key: string, repo: boolean): Promise<void> {
	validate_key(key);
	if (!repo) {
		const branch = await current_branch();
		if (branch) {
			const branch_result = await cfg_run(config_file, ['--get', `${branch_section(branch)}.${key}`]);
			if (branch_result.code === 0) {
				process.stdout.write(branch_result.stdout);
				return;
			}
			if (branch_result.code !== 1) report_git_failure(branch_result);
		}
	}

	const repo_result = await cfg_run(config_file, ['--get', `${repo_section()}.${key}`]);
	if (repo_result.code === 0) {
		process.stdout.write(repo_result.stdout);
			return;
	}
	if (repo_result.code !== 1) report_git_failure(repo_result);
}

async function set_command(config_file: string, key: string, value: string, repo: boolean): Promise<void> {
	validate_key(key);
	const section = repo ? repo_section() : branch_section(await require_branch());
	const result = await cfg_run(config_file, [`${section}.${key}`, value]);
	if (result.code !== 0) report_git_failure(result);
}

async function unset_command(config_file: string, key: string, repo: boolean): Promise<void> {
	validate_key(key);
	const section = repo ? repo_section() : branch_section(await require_branch());
	const result = await cfg_run(config_file, ['--unset', `${section}.${key}`]);
	if (result.code !== 0 && result.code !== 5) report_git_failure(result);
}

async function list_command(config_file: string, repo: boolean): Promise<void> {
	const repo_entries = await read_scope(config_file, repo_section(), 'repo');
	if (repo) {
		print_entries(repo_entries, true);
		return;
	}

	const branch = await require_branch();
	const branch_entries = await read_scope(config_file, branch_section(branch), 'branch');
	const branch_keys = new Set(branch_entries.map((entry) => entry.key));
	print_entries([...branch_entries, ...repo_entries.filter((entry) => !branch_keys.has(entry.key))], true);
}

async function list_all_command(config_file: string): Promise<void> {
	const repo_entries = await read_scope(config_file, repo_section(), 'repo');
	const branch = await current_branch();
	const branch_entries = branch ? await read_scope(config_file, branch_section(branch), 'branch') : [];
	print_entries([...repo_entries, ...branch_entries], false);
}

async function rm_command(config_file: string, repo: boolean): Promise<void> {
	const section = repo ? repo_section() : branch_section(await require_branch());
	const result = await cfg_run(config_file, ['--remove-section', section]);
	if (result.code !== 0 && result.code !== 5) report_git_failure(result);
}

async function rename_command(config_file: string, next: string, repo: boolean): Promise<void> {
	if (repo) usage_error('rename does not support --repo.');
	const result = await cfg_run(config_file, [
		'--rename-section',
		branch_section(await require_branch()),
		branch_section(next),
	]);
	if (result.code !== 0) report_git_failure(result);
}

export async function main(argv = Bun.argv.slice(2)): Promise<void> {
	const { args, command, repo } = parse_command(argv);
	const config_file = `${await git_common_dir()}/config`;

	switch (command) {
		case 'get':
			if (args.length !== 1) usage_error('get requires <key>.');
			return get_command(config_file, args[0]!, repo);
		case 'set':
			if (args.length !== 2) usage_error('set requires <key> <value>.');
			return set_command(config_file, args[0]!, args[1]!, repo);
		case 'unset':
			if (args.length !== 1) usage_error('unset requires <key>.');
			return unset_command(config_file, args[0]!, repo);
		case 'list':
			if (args.length !== 0) usage_error('list accepts no arguments.');
			return list_command(config_file, repo);
		case 'list-all':
			if (args.length !== 0 || repo) usage_error('list-all accepts no arguments or flags.');
			return list_all_command(config_file);
		case 'rm':
			if (args.length !== 0) usage_error('rm accepts no arguments.');
			return rm_command(config_file, repo);
		case 'rename':
			if (args.length !== 1) usage_error('rename requires <new-branch>.');
			return rename_command(config_file, args[0]!, repo);
		default:
			usage_error(`Unknown command: ${command}.`);
	}
}
