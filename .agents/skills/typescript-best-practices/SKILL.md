---
name: typescript-best-practices
description: TypeScript conventions from real projects. snake_case files/fns/vars. Effect-TS. Drizzle ORM. vitest. arktype validation. oRPC. tagged errors. cuid2 IDs. readonly interfaces. named exports. Use when writing TypeScript code.
---

# TS Patterns (submit7 / ffb)

## Naming

- **snake_case** for files, dirs, fns, vars
- PascalCase for types/interfaces/components
- `SCREAMING_SNAKE` for constants
- No default exports. Named exports only.

## Types

```ts
// tagged errors: _tag + readonly
export class AdapterNetworkError {
  readonly _tag = "AdapterNetworkError" as const;
  constructor(
    readonly message: string,
    readonly statusCode?: number,
  ) {}
}
export type AdapterError = AdapterNetworkError | AdapterParseError;

// public interfaces: readonly everywhere
export interface JobAdapter {
  readonly id: string;
  readonly fetch: (ctx: AdapterContext) => Effect.Effect<JobInput[], AdapterError>;
}
```

- `interface` for public contracts
- `type` for unions, utility types, inferred types
- `import type { ... }` for type-only imports

## Drizzle ORM

```ts
// schema: sqliteTable, cuid2 primary key
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    site_id: text("site_id")
      .notNull()
      .references(() => sites.id),
    title: text("title").notNull(),
    created_at: integer("created_at", { mode: "number" }).notNull(),
    updated_at: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("idx_jobs_site_id").on(table.site_id)],
);
```

- `{ mode: 'number' }` for unix timestamps
- Soft delete: `deleted_at: integer('deleted_at', { mode: 'number' })`
- Barrel exports: `export { jobs } from './jobs'`

## Effect-TS (submit7)

```ts
// Service layer
export class AdapterRegistry extends Context.Service<AdapterRegistry, AdapterRegistryShape>()('AdapterRegistry') {}

// Live impl
export const AdapterRegistryLive: Layer.Layer<AdapterRegistry> = Layer.sync(AdapterRegistry, () => new Map())

// Composition
Effect.succeed(input).pipe(
  Effect.flatMap(transform),
  Effect.map(format),
  Effect.matchEffect({ onSuccess: ..., onFailure: ... }),
)
```

- `Effect.gen(function* () { ... })` for imperative-style
- `Effect.tryPromise(() => db.insert(...).returning())` wrapping async
- `Effect.fail(new AdapterNetworkError(...))` for errors

## Validation (ffb)

```ts
import { type } from "arktype";
export const LoginInput = type({ email: "string.email", password: "string" });
export type LoginInput = typeof LoginInput.infer;
```

## oRPC Procedures (ffb)

```ts
export const login = base
  .input(LoginInput)
  .route({ method: 'POST', path: '/auth/login' })
  .handler(async ({ input, context }) => { ... })
```

## Repository Pattern (ffb)

1 file per query. Function receives `db: Database`, returns typed row.

```ts
import type { Database } from "#/db/index";
export async function find_user_by_email(db: Database, email: string) {
  const user = await db
    .select()
    .from(users)
    .where(sql`...`)
    .get();
  return user ?? null;
}
```

## DB Singleton (ffb)

```ts
const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    return Reflect.get(get_db(), prop);
  },
});
```

Lazy init avoids env var requirement at import time.

## Testing

```ts
// riteway-style: describe('feature'), test('given X: should Y')
describe('account_card', () => {
  test('given a deposit account: should display name, balance, deposit icon', () => {
    render(<AccountCard name="Nubank" balance={123456} delta={500} type="deposit" />)
    expect(screen.getByText('Nubank')).toBeDefined()
  })
})
```

- Colocated `.test.ts` next to source
- Test DB: `beforeAll` → `create_test_db()`, `afterAll` → `destroy_test_db()`
- Temp SQLite file per test suite (submit7: `mkdtempSync`, ffb: copy `schema_only.db`)

## Config

```jsonc
// tsconfig strict flags
"strict": true,
"verbatimModuleSyntax": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noUncheckedIndexedAccess": true,  // submit7
"noImplicitOverride": true,         // submit7
"moduleResolution": "bundler",
"allowImportingTsExtensions": true,
"noEmit": true,
```

- submit7: `"types": ["bun", "vitest/importMeta"]`
- ffb: `"types": ["vite/client"]`, path alias `"#/*": ["./src/*"]`

## Misc

- Timestamps: unix seconds, integer columns
- `cuid2` for IDs (`createId()`)
- `cn()` (clsx + twMerge) for component class merging (ffb)
- Biome for lint+format (ffb), oxlint for lint (submit7)
- `// biome-ignore lint/...` for explicit suppressions
- No classes (except tagged error classes)
- Pure fns preferred
