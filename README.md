# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Cloudflare Workers

The SPA and the API are served by a single Worker (`worker/index.ts`, built with Hono). `npm run dev` and `npm run preview` both run it on the Workers runtime.

The Worker's types live in `worker-configuration.d.ts`, which is generated rather than committed. `npm run build` regenerates it, but after a fresh clone run `npm run cf-typegen` once so the editor can resolve it. Run it again after editing `wrangler.jsonc`.
