# Fitting Room: Virtual Try-On

A Next.js app. You upload a photo of a person and a photo of a garment, and an n8n workflow generates the person wearing that garment.

```
Browser ──POST image1, image2──▶ /api/generate (Next.js server route) ──▶ n8n webhook
        ◀──────── image ────────                                      ◀── binary image
```

The browser never talks to n8n directly. The webhook URL and secret only exist on the server.

## Setup
Requires Node.js 20 or newer.

```bash
cp .env.example .env.local   # then fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |

### Environment variables
| Variable | Required | Description |
| --- | --- | --- |
| `N8N_WEBHOOK_URL` | Yes | The n8n Webhook node's production URL |
| `N8N_WEBHOOK_SECRET` | Recommended | Sent as the `X-Webhook-Secret` header so n8n can reject anyone else |
| `SUPABASE_URL` | Yes | The Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | The project's publishable key (`sb_publishable_...`) |

All of them are **server-only**. Never give them a `NEXT_PUBLIC_` prefix, or they will be embedded in the browser JavaScript. After changing `.env.local`, restart `npm run dev`.

## Accounts (Supabase Auth)
Users sign up with their name, email and password, confirm their email, and then log in. Signed-out visitors are redirected to `/login`, and `/api/generate` returns 401 without a session. All auth runs on the server through Server Actions, so the browser never calls Supabase directly. Each new user's name is copied into the `public.profiles` table by a database trigger.

Do these steps once in the Supabase dashboard:
1. **Authentication → URL Configuration:**
   - Set **Site URL** to your production domain.
   - Add `http://localhost:3000/**` and `https://*-<your-team>.vercel.app/**` to **Redirect URLs**.
2. **Authentication → Emails → Confirm signup (recommended):** set the link in the template to
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
   The app sends `<current origin>/auth/confirm` as the redirect, so links work on localhost, previews and production. `/auth/confirm` also accepts the default template's `?code=` link, but that link only works in the browser where the user signed up.
3. **Authentication → Sign In / Providers → Email:** keep **Confirm email** on, and set the minimum password length to 8.
4. **Production:** configure custom SMTP. Supabase's built-in mailer only sends a few emails per hour.

## The n8n workflow
- **Webhook node:** method `POST`, and **Respond** set to "Using 'Respond to Webhook' node". It receives two binary fields, `image1` (the person) and `image2` (the garment), each a PNG, JPEG or WebP file.
- **Authentication (recommended):** set it to **Header Auth**, with the header name `X-Webhook-Secret` and the same value as `N8N_WEBHOOK_SECRET`. You can remove any `*` value from Allowed Origins (CORS), since browsers no longer call the webhook.
- **Respond to Webhook node:** respond with **Binary File**. The file must be a PNG, JPEG or WebP image. A JSON response is rejected.

## Deploy to Vercel
1. Push this repo to GitHub and import it at vercel.com/new. Vercel detects Next.js automatically.
2. Under **Project → Settings → Environment Variables**, add `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, then redeploy.
3. Recommended: under **Firewall**, add a rate-limit rule for `/api/generate`.

## Security
- **`/api/generate` checks every request.** It only accepts POSTs from the app's own origin, and it verifies that each upload really is a PNG, JPEG or WebP by inspecting the file contents. Uploaded files are renamed before they are forwarded to n8n.
- **Abuse limit:** about 10 generations per IP every 10 minutes. This counter is kept per server instance, so the Vercel Firewall rule above is what really enforces it.
- **Error messages** shown to users are generic. Details are logged on the server only.
- **Security headers** are set in `next.config.ts`: a Content-Security-Policy, `X-Frame-Options: DENY`, HSTS, `nosniff`, Referrer-Policy and Permissions-Policy.

## Limits
- **Upload size:** each image is at most 2 MB after processing, because Vercel functions reject request bodies over 4.5 MB. Larger images are downscaled in the browser before upload. PNGs stay PNG, so transparency is kept.
- **Generation time:** up to 300 s, the function's `maxDuration`.
- **Result size:** the returned image must fit within Vercel's 4.5 MB function response limit.

## Troubleshooting
| Message | Likely cause |
| --- | --- |
| "The server is not configured." | `N8N_WEBHOOK_URL` is missing. Set it, then restart the server or redeploy. |
| "The generator failed to process these images." | n8n returned an error status. Check the workflow's executions in n8n. |
| "The generator did not return an image." | The Respond to Webhook node is sending JSON or text instead of a binary image. |
| "Generation timed out." | The workflow took longer than about 290 s. |
| "Too many requests." | The per-IP rate limit was hit. Wait 10 minutes. |
| "Forbidden." | The request came from another origin, or came without an `Origin` header. |
| "Please log in to continue." | `/api/generate` was called without a valid session. The page sends the user to `/login`. |
| "Please confirm your email first." | The user hasn't clicked the link in the confirmation email yet. |
| "That confirmation link is invalid or has expired." | The link was already used or is too old, or the email template isn't set up as described in Accounts. |
| No confirmation email after signing up | The email is already registered (Supabase sends nothing, so accounts can't be discovered), or the email rate limit was hit. Log in instead, or check Auth logs. |
| "Could not create account." | Supabase rejected the sign-up, often because of the email rate limit. Check Auth logs in Supabase. |
