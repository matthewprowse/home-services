# Code maintainability and requirements

This document defines code style, maintainability, and language requirements for the **app** project. All contributors and tooling must follow these rules.

---

## 1. Language and locale

- **British English** must be used throughout:
  - User-facing copy (UI, messages, errors).
  - Comments, documentation, and commit messages.
  - Variable names and identifiers when they read as words (e.g. `colour`, `behaviour`; prefer technical terms like `color` only when referring to CSS or APIs that use American spelling).

Examples: *colour*, *behaviour*, *organisation*, *optimise*, *licence* (noun), *centre*, *favour*.

---

## 2. File headers

Every source file (e.g. `.ts`, `.tsx`, `.js`, `.jsx`, `.sql`) must start with a block comment header that includes:

- **File:** the file name.
- **Description:** one or two lines describing the file’s purpose.

Optional: author, last updated, or module name if useful.

Example (TypeScript/JavaScript):

```ts
/**
 * File: my-component.tsx
 * Description: Renders the main dashboard header and navigation.
 */
```

Example (SQL):

```sql
-- =============================================================================
-- File: 01_tables.sql
-- Description: Supabase schema — table definitions.
-- =============================================================================
```

Headers keep the codebase navigable and make intent clear at a glance.

---

## 3. Indentation and formatting

- **Indentation:** **4 spaces** (no tabs).
- **Formatting:** enforced by **Prettier**; run format before committing.
- Configuration lives in `.prettierrc` (and optionally `.editorconfig`). Do not override with 2-space or tabs in source.

This aligns with many Google-internal style rules (e.g. 4-space indent) and keeps the project consistent.

---

## 4. Alignment with Google style practices

Where not overridden by this document or project config, follow **Google TypeScript Style Guide** and **Google JavaScript Style Guide**:

- **Source basics:** UTF-8, LF line endings, no trailing whitespace.
- **Naming:** `camelCase` for variables/functions; `PascalCase` for types/classes/components; `UPPER_SNAKE_CASE` for constants; meaningful names.
- **Imports:** grouped and ordered (e.g. external → internal → relative); no default exports unless required by framework (e.g. Next.js pages/layouts).
- **Types:** prefer TypeScript strict mode; avoid `any`; use explicit return types for public functions.
- **Files:** one primary type or component per file where practical; lowercase file names with dashes or camelCase as per framework conventions (e.g. Next.js).
- **Comments:** clear, concise; explain “why” when non-obvious; keep British English.

Reference: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html), [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html).

---

## 5. Linting and tooling

- **ESLint:** use project ESLint config; fix lint errors before commit.
- **Prettier:** use for formatting only; 4-space indent as above.
- **TypeScript:** no `strict: false`; resolve type errors before merging.

Running `npm run lint` and the configured format check (e.g. `npm run format` or Prettier in CI) must pass.

---

## 6. Maintainability principles

- **DRY:** avoid duplication; extract shared logic and UI into `lib/`, `hooks/`, and reusable components.
- **Single responsibility:** one clear purpose per module/component.
- **Small functions:** keep functions and components short and readable.
- **Explicit over implicit:** clear naming and types; avoid magic values (use named constants).
- **Accessibility:** semantic HTML and ARIA where needed; follow a11y best practices for UI.
- **Security:** never commit secrets; use env vars; validate/sanitise user input; follow RLS and auth rules (e.g. Supabase) as defined in the project.

---

## 7. Project structure

Respect the established folders:

- `src/app/` — Next.js App Router (routes, layouts, pages).
- `src/app/(auth)/` — auth-related routes (e.g. sign-in, sign-up).
- `src/app/(dashboard)/` — authenticated dashboard routes.
- `src/app/api/` — API routes.
- `src/components/ui/` — shadcn/ui and low-level UI components.
- `src/components/layout/` — layout components (header, sidebar, etc.).
- `src/lib/` — utilities, Supabase client, shared logic.
- `src/hooks/` — custom React hooks.
- `src/types/` — shared TypeScript types.
- `supabase/` — SQL migrations: `01_tables.sql` (schema), `02_rls.sql` (RLS policies).

Add new code in the appropriate place; do not add ad-hoc folders at the root of `src/` without agreement.

---

## 8. Supabase and SQL

- Schema changes: add to `supabase/01_tables.sql` (or new numbered migrations) and document in the file header.
- RLS: all policies in `supabase/02_rls.sql` (or later RLS-only migrations); never disable RLS without a documented reason.
- Use British English in comments and naming (e.g. `organisation`, `organisation_members`).

---

## 9. Summary checklist

Before committing or opening a PR, ensure:

- [ ] British English in copy, comments, and docs.
- [ ] File header present in new/changed source files.
- [ ] 4-space indentation; Prettier has been run.
- [ ] ESLint passes; TypeScript compiles with no errors.
- [ ] No secrets or sensitive data in code.
- [ ] New code lives in the correct folder and follows the structure above.

These requirements keep the codebase minimal, clean, and adaptable for an AI SaaS app.
