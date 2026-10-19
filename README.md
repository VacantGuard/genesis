# Hearth Prep

A meal prep platform: a public one-page site and a private staff terminal that share one SQLite database.

The public page (`/`) has three sections:

- **Menu** — this week’s meal categories, names, descriptions, prices, and availability
- **About** — copy from the editable business profile
- **POS** — cart, customer details, delivery address, and a practice card payment that records a paid order for delivery

The staff terminal (`/terminal`) is a separate login-gated desk for the weekly menu, customers (with delivery addresses), companies, text campaigns, paid orders, agent settings, and the business profile.

Payment and texting are local mocks. No card is charged, and no SMS leaves the machine. Every meal order is delivered; driver routing software is not included yet. The agent can read client drops at `GET /api/agent/clients` (optional `?q=` filter), including a Google Maps `locateUrl` for each address.

**Public site URL for agents:** save it on Terminal → Agent. Menu texts and agent payloads use that sticky URL (`…/#pos`). They do not follow localhost or a changing tunnel host.

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

On the public POS section, enter a delivery address (street, city, state, ZIP), any name, and a card number that passes a basic check. This test number works:

`4242 4242 4242 4242`

Use a future expiry (`12/28`) and any 3-digit CVC. Only the last four digits are stored. Nothing is sent to a payment network.

## Text campaigns

The terminal logs each outbound text locally and prints a line to the server console (`[local-sms]`). It does not call Twilio or any other SMS provider. Each campaign stores the public menu link that was included (`/#pos`).

## Seeded sample data

The first launch inserts sample content you can edit or delete:

- Business name **Hearth Prep** and about copy for a meal prep kitchen
- A weekly portioned menu (breakfasts, mains, sides) with one sold-out meal
- Company **Sample Studio Co.** and three sample customers (555 numbers and `.example` emails)

## Scripts

- `npm run dev` — development server on port 43123
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — production server on port 43123
