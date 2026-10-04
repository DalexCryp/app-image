# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev`: dev server on http://localhost:3000
- `npm run build`: production build, which also type-checks. Use it to verify changes.
- `npm start`: serve the production build

There is no linter and there are no tests. Env vars come from `.env.local` (template: `.env.example`), and the dev server must be restarted after editing it. On Vercel, env var changes only take effect after a redeploy. Pushing to `main` deploys to production.

Every page except `/login` and `/signup` needs a session, so a signed-out `curl localhost:3000/` returns a 307 to `/login`. A signed-out POST to `/api/generate` returns 401, after the origin check.

To exercise the API route by hand, send an `Origin` header that matches the host. Without one the route returns 403:
```bash
curl -X POST localhost:3000/api/generate -H "Origin: http://localhost:3000" -F image1=@a.png -F image2=@b.png -o out.png
```
Valid images reach the real n8n workflow, which may use paid AI credits. Use invalid files to test only the rejection paths.

## Architecture
A single-page Virtual Try-On app built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS v4, deployed on Vercel.

- **Request flow:**
  1. `app/page.tsx` (a Server Component) renders `components/site-header.tsx` and `components/try-on.tsx`. The latter is a client component and takes two images (`image1` = person, `image2` = clothing).
  2. `lib/shrink-image.ts` downscales any image over the size limit in the browser. PNGs stay PNG so transparency is kept.
  3. The page POSTs the images to `app/api/generate/route.ts`.
  4. That route validates them and forwards them to the n8n webhook, which returns a **binary image** (not JSON).
  5. The route checks that the result is an image and returns it. The page shows it through `URL.createObjectURL`.
- **The n8n webhook must never be called from the browser.** Its URL (`N8N_WEBHOOK_URL`) and optional secret (`N8N_WEBHOOK_SECRET`, sent as the `X-Webhook-Secret` header) are server-only env vars in `.env.local` (see `.env.example`). Never give them a `NEXT_PUBLIC_` prefix and never hardcode them.
- **Auth (Supabase):** all auth runs on the server, which is why the CSP can stay `connect-src 'self'`. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are server-only, so do not add a browser Supabase client.
  - `proxy.ts` (Next 16's name for middleware) calls `lib/supabase/proxy.ts`. That file refreshes the session and redirects signed-out visitors to `/login`. It skips `/api/*` and `/auth/*`.
  - Sign-up, login and logout are Server Actions in `app/(auth)/actions.ts`. The forms are in `components/auth-form.tsx`.
  - Email confirmation lands on `app/auth/confirm/route.ts`. It accepts both `?token_hash=&type=` (`verifyOtp`, from the custom email template) and `?code=` (`exchangeCodeForSession`, from the default template), so keep both branches.
  - `/api/generate` returns 401 without a session.
  - Always use `auth.getClaims()` on the server, never `getSession()`.
  - Each user's name is stored in `user_metadata.full_name`, and a trigger copies it to `public.profiles` (RLS: each user can read only their own row).
    - That schema (migration `create_profiles`) exists only in the Supabase project, not in this repo. Inspect it with the Supabase MCP tools (`list_tables`, `list_migrations`) and change it with `apply_migration`, then run `get_advisors`.
  - Testing sign-up sends real emails, and Supabase's built-in mailer allows only a few per hour.
    - Signing up again with an already-registered email returns success but sends nothing, on purpose.
    - To debug, read the Supabase `auth_logs` (`query_logs`) and `auth.users` instead of guessing.
  - Dashboard settings (Site URL, Redirect URLs, email template) aren't in code. The README's Accounts section lists them.
- **Defences in the route:** a same-origin check (requests without an `Origin` header are rejected), a best-effort in-memory per-IP rate limit, verification of PNG, JPEG and WebP by magic bytes (the client-supplied type is not trusted), and file renaming before forwarding. Errors sent to the client are generic; details go to `console.error` only.
- **Size limits are shared** through `lib/upload-limits.ts` (2 MB per image), because Vercel rejects function request bodies over 4.5 MB. The route sets `maxDuration = 300` and an upstream timeout of 290 s, since generation is slow. The result is buffered before it is returned, so it must also fit Vercel's 4.5 MB response limit.
- User-facing error strings are matched in the README's Troubleshooting table. Keep the two in sync when changing them.
- **Security headers** (including a CSP with `connect-src 'self'`) are set in `next.config.ts`. If the page ever needs a new external origin, such as a font CDN or analytics, it must be added to the CSP there.
- Object URLs (previews and the result) are revoked when they are replaced, and on unmount. Keep this when changing how files are selected.
- When editing the request, do not set a `Content-Type` header on the fetch. The browser must add the multipart boundary itself.

## Styling
The UI imitates the look of a luxury department-store site (the reference screenshot is `Captura de tela 2026-10-03 210347.png`): a navy announcement bar, a spaced-uppercase wordmark, pill chips, gray bordered cards, and a black uppercase button. It uses its own name, "Fitting Room". Do not add the real store's branding.
Theme tokens live in `app/globals.css` under `@theme` (`navy`, `card`, and `--font-sans`, which is mapped to Jost and loaded in `app/layout.tsx`). Tailwind v4 is configured through `@tailwindcss/postcss`; there is no `tailwind.config` file.

The `nextjs-agent-rules` block below is generated by `next dev` and re-added on every start. Leave it in place.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
