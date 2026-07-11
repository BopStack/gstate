---
name: riteway-test-naming
description: Riteway-style test naming for Vitest/Jest describe/test blocks. Use when writing or renaming unit tests and the user asks for riteway naming, given/should style, or RITE-style tests.
---

# Riteway Test Naming

Every test answers 5 questions: unit, behavior, actual, expected, reproduction.

## Pattern

```ts
describe("unitName()", () => {
  test("given <condition>: should <behavior>", () => {
    expect(actual).toEqual(expected);
  });
});
```

## Rules

- `describe` → unit name only. Function: `'sum()'`. Component: `'ClickCounter component'`. Module: `'auth helpers'`.
- `test` → `'given <input/context>: should <observable behavior>'`. Lowercase. Prose. No filler ("correctly", "properly").
- One assertion per `test` when practical. Same `should` across cases → extract to `const should = '...'`.
- `given` describes the input or state. `should` describes the output or effect. Both must read as plain english.

## Examples

```ts
describe('sum()', () => {
  test('given no arguments: should return 0', () => { ... });
  test('given negative numbers: should return the correct sum', () => { ... });
  test('given NaN: should throw', () => { ... });
});

describe('expandMatcher()', () => {
  test('given single-tenant mode: should skip instanceId key', () => { ... });
});
```

## Anti-patterns

- `test('works')` — no given, no should.
- `test('should return sum correctly')` — no given, filler word.
- `describe('test sum')` — "test" is noise; unit name only.
- `test('returns 0 when called with nothing')` — reorder to `given ...: should ...`.
