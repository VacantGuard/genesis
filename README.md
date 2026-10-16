# Hearth Prep

A meal prep platform: a public one-page site and a private staff terminal that share one SQLite database.

The public page (`/`) has three sections:

- **Menu** — this week’s meal categories, names, descriptions, prices, and availability
- **About** — copy from the editable business profile
- **POS** — cart, customer details, and a practice card payment that records a paid order

The staff terminal (`/terminal`) is a separate login-gated desk for the weekly menu, customers, companies, text campaigns, paid orders, and the business profile.

Payment and texting are local mocks. No card is charged, and no SMS leaves the machine. There is no delivery or driver workflow.

## Run it

Node.js 22 or newer.

```bash
npm install
npm run dev
```

The dev server binds to `0.0.0.0:43123`.

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) for the public menu, and [http://127.0.0.1:43123/terminal](http://127.0.0.1:43123/terminal) for the staff terminal.

The database file is `data/kitchen.sqlite`. It is created on first launch and kept across restarts. It is not committed.

## Seeded staff login

These defaults work with no environment variables and no secrets:

| | |
| --- | --- |
| Username | `admin` |
| Password | `kitchen-local` |

Override them with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` if you want. There is no public signup.

## Practice checkout

On the public POS section, use any name and a card number that passes a basic check. This test number works:

`4242 4242 4242 4242`

Use a future expiry (`12/28`) and any 3-digit CVC. Only the last four digits are stored. Nothing is sent to a payment network.

## Text campaigns

The terminal logs each outbound text locally and prints a line to the server console (`[local-sms]`). It does not call Twilio or any other SMS provider. Each campaign stores the public menu link that was included (`/#pos`).

## Seeded sample data

The first launch inserts sample content you can edit or delete:

- Business name **Hearth Prep** and about copy for a meal prep kitchen
- A weekly portioned menu (breakfasts, mains, sides) with one sold-out meal
- Company **Sample Studio Co.** and three sample customers (555 numbers and `.example` emails)

## Trigger.dev

Background automations live under `src/trigger/` and run on Trigger.dev v4.5.15.

Agent workflow rules: `CLAUDE.md`. SDK patterns: `trigger-ref.md`. Cursor MCP: `.cursor/mcp.json`.

1. Create a project at [cloud.trigger.dev](https://cloud.trigger.dev) and copy the project ref plus a secret key.
2. Copy `.env.example` to `.env` and set `TRIGGER_PROJECT_REF` and `TRIGGER_SECRET_KEY`.
3. In another terminal: `npm run trigger:dev`
4. Smoke-test the registered task `health-ping` (empty payload is fine).

Do not deploy with `npm run trigger:deploy` until a local run has succeeded and you explicitly approve a deploy. Add the same env vars in the Trigger.dev dashboard (staging and prod) before any production deploy.

## Scripts

- `npm run dev` — development server on port 43123
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — production server on port 43123
- `npm run trigger:dev` — Trigger.dev local worker (needs `.env`)
- `npm run trigger:deploy` — deploy tasks (needs approval + dashboard env vars)
