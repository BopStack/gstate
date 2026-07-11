import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CLI = path.resolve(import.meta.dir, '../index.ts');
const repos: string[] = [];

afterEach(async () => {
	await Promise.all(repos.splice(0).map((repo) => rm(repo, { force: true, recursive: true })));
});

async function run(command: string[], cwd: string, env: Record<string, string> = {}) {
	const proc = Bun.spawn(['bun', CLI, ...command], {
		cwd,
		env: { ...process.env, ...env },
		stderr: 'pipe',
		stdout: 'pipe',
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { exitCode, stderr, stdout };
}

async function create_repo(branch = 'feature/demo'): Promise<string> {
	const repo = await mkdtemp(path.join(tmpdir(), 'gstate-'));
	repos.push(repo);
	const init = Bun.spawn(['git', 'init', '-q', '-b', branch], { cwd: repo });
	expect(await init.exited).toBe(0);
	const commit = Bun.spawn(
		[
			'git',
			'-c',
			'user.email=gstate@example.test',
			'-c',
			'user.name=gstate',
			'commit',
			'--allow-empty',
			'--quiet',
			'-m',
			'initial',
		],
		{ cwd: repo },
	);
	expect(await commit.exited).toBe(0);
	return repo;
}

describe('gstate CLI', () => {
	test('given repository and branch values: should resolve branch state before repository state', async () => {
		const repo = await create_repo();

		expect((await run(['set', 'editor', 'vim', '--repo'], repo)).exitCode).toBe(0);
		expect((await run(['set', 'editor', 'code'], repo)).exitCode).toBe(0);
		expect(await run(['get', 'editor'], repo)).toMatchObject({ exitCode: 0, stdout: 'code\n' });
		expect(await run(['get', 'editor', '--repo'], repo)).toMatchObject({
			exitCode: 0,
			stdout: 'vim\n',
		});
	});

	test('given a repository default and no branch override: should expose its repository origin in resolved listing', async () => {
		const repo = await create_repo();

		expect((await run(['set', 'theme', 'dark', '--repo'], repo)).exitCode).toBe(0);
		const result = await run(['list'], repo);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('theme dark (repo)');
	});

	test('given no branch-specific key: should silently retain repository state when unsetting', async () => {
		const repo = await create_repo();

		expect((await run(['set', 'editor', 'vim', '--repo'], repo)).exitCode).toBe(0);
		expect(await run(['unset', 'editor'], repo)).toMatchObject({
			exitCode: 0,
			stderr: '',
			stdout: '',
		});
		expect(await run(['get', 'editor'], repo)).toMatchObject({ exitCode: 0, stdout: 'vim\n' });
	});

	test('given detached HEAD: should allow repository-scoped operations', async () => {
		const repo = await create_repo();
		const detach = Bun.spawn(['git', 'checkout', '--detach', '--quiet'], { cwd: repo });
		expect(await detach.exited).toBe(0);

		expect((await run(['set', 'theme', 'dark', '--repo'], repo)).exitCode).toBe(0);
		expect(await run(['get', 'theme', '--repo'], repo)).toMatchObject({
			exitCode: 0,
			stdout: 'dark\n',
		});
	});

	test('given a branch name containing regex syntax: should not list state from a similarly named branch', async () => {
		const repo = await create_repo('feature/foo.bar');

		expect((await run(['set', 'owned', 'yes'], repo)).exitCode).toBe(0);
		const injected = Bun.spawn(
			['git', 'config', '--file', `${repo}/.git/config`, 'state.feature/fooXbar.leaked', 'no'],
			{ cwd: repo },
		);
		expect(await injected.exited).toBe(0);

		const result = await run(['list'], repo);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('owned yes (branch)');
		expect(result.stdout).not.toContain('leaked');
	});

	test('given branch state: should migrate it without changing repository state', async () => {
		const repo = await create_repo();

		expect((await run(['set', 'editor', 'vim', '--repo'], repo)).exitCode).toBe(0);
		expect((await run(['set', 'editor', 'code'], repo)).exitCode).toBe(0);
		expect((await run(['rename', 'feature/next'], repo)).exitCode).toBe(0);
		expect(await run(['get', 'editor'], repo, { GIT_STATE_BRANCH: 'feature/next' })).toMatchObject({
			exitCode: 0,
			stdout: 'code\n',
		});
		expect(await run(['get', 'editor', '--repo'], repo)).toMatchObject({
			exitCode: 0,
			stdout: 'vim\n',
		});
	});

	test('given branch repo: should intentionally share repository-scoped state', async () => {
		const repo = await create_repo('repo');

		expect((await run(['set', 'editor', 'code'], repo)).exitCode).toBe(0);
		expect(await run(['get', 'editor', '--repo'], repo)).toMatchObject({
			exitCode: 0,
			stdout: 'code\n',
		});
	});

	test('given no value in either scope: should return successful empty output', async () => {
		const repo = await create_repo();

		expect(await run(['get', 'absent'], repo)).toMatchObject({
			exitCode: 0,
			stderr: '',
			stdout: '',
		});
	});
});
