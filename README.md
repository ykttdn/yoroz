# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Cloudflare Workers

The SPA and the API are served by a single Worker (`worker/index.ts`, built with Hono). `npm run dev` and `npm run preview` both run it on the Workers runtime.

The Worker's types live in `worker-configuration.d.ts`, which is generated rather than committed. `npm run build` regenerates it, but after a fresh clone run `npm run cf-typegen` once so the editor can resolve it. Run it again after editing `wrangler.jsonc`.

### Google sign-in

`/login` is a public login page and signing in lands on `/`. The SPA's files are served to anyone; what sign-in protects is `/api/*`, and the router only uses `/api/me` to decide which page to show. Only addresses listed in `ALLOWED_EMAILS` get in, and the list is checked on every API request, so removing an address from it locks that user out right away. The session is a signed JWT in an HttpOnly cookie, so there is no server-side store; short of that, a session cannot be revoked before it expires (7 days) except by rotating `AUTH_SECRET`.

1. In Google Cloud Console, create an OAuth client ID of type "Web application" and add these authorized redirect URIs:
   - `http://localhost:5173/auth/google` (`npm run dev`)
   - `http://localhost:4173/auth/google` (`npm run preview`)
   - `https://yoroz.ykttdn.workers.dev/auth/google`
2. Copy `.dev.vars.example` to `.dev.vars` and fill it in. Generate `AUTH_SECRET` with `openssl rand -base64 32`. `npm run preview` reads the copy that `npm run build` puts in `dist/`, so rebuild after editing `.dev.vars`.
3. Set the same four values on the deployed Worker once with `npx wrangler secret put <NAME>`. The GitHub Actions deploy does not upload secrets.

### Database

The Worker uses a D1 database bound as `DB`, accessed through Drizzle. The schema lives in `worker/db/schema.ts` and the migrations generated from it in `migrations/`.

- After editing the schema, run `npm run db:generate` to write a new migration, and read the generated SQL before committing it. drizzle-kit can express some changes (a rename, for instance) as a drop and re-create, which loses data.
- Run `npm run db:migrate:local` to apply migrations to the local database that `npm run dev` uses. The tests apply them to their own database, so they need no setup.
- The deploy workflow applies migrations to the production database before deploying the Worker. Migrations must therefore keep the previously deployed code working, since it keeps serving requests until the deploy finishes.

The production database is named `yoroz`, and its `database_id` is in `wrangler.jsonc`. The `CLOUDFLARE_API_TOKEN` used by GitHub Actions needs the D1 Edit permission in addition to what deploying a Worker requires.

### Deploying

`npm run deploy` publishes to https://yoroz.ykttdn.workers.dev. It builds first so that a stale `dist/` is never uploaded; `wrangler deploy` on its own would ship whatever was built last. It does not apply migrations; when deploying by hand, run `npx wrangler d1 migrations apply DB --remote` first.

Authenticate once with `npx wrangler login`.
