# Meal prep desk

A meal prep platform sold to meal prep businesses. A buyer configures one business: its public menu, clients, and Slack workspace. The public site and the staff terminal share one SQLite database.

The public page (`/`) has three sections:

- **Menu** — this week’s meal categories, names, descriptions, prices, and availability
- **About** — copy from the editable business profile
- **POS** — cart, customer details, and a practice card payment that records a paid order

The staff terminal (`/terminal`) is a separate login-gated desk for that business: weekly menu, customers, companies, text campaigns, paid orders, the business profile, and the Slack workspace id.

The homepage (`/`) and `/b/{slug}` show the same business.

Payment is the practice card checkout. Texting writes the local text log. No card is charged, and no SMS leaves the machine. There is no delivery or driver workflow.

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

The terminal logs each outbound text locally and prints a line to the server console (`[local-sms]`). It does not call Twilio or any other SMS provider. Each campaign stores that business’s public menu link (`/b/{slug}#pos`).

The Slack agent in `prep-desk` uses this same log. It does not send a second kind of text.

## Slack agent

`prep-desk` is the product agent. It is not tied to one kitchen. On a mention or direct message it reads the Slack workspace id and opens the business that has that id saved under Terminal → Slack. If the id is not saved, it replies with the workspace id and does not change a menu.

From Slack, staff can ask it to read the weekly menu, change or remove a meal, or text that business’s clients. A real menu change logs a text to that business’s customers and company contacts, including the public menu link.

Tokens are created with the BDK Slack wizard and stored in `prep-desk/.env.local` as `PREP_DESK_SLACK_BOT_TOKEN` and `PREP_DESK_SLACK_APP_TOKEN`. Do not put them in `.env`.

```bash
cd prep-desk
npm install
npx --yes "@cursor/bdk@0.2.25" login
npx --yes "@cursor/bdk@0.2.25" slack create --dir .
npm run dev
```

`npm run dev` loads the agent with the TypeScript loader so the tools can use the kitchen database. The kitchen app must already be running so both processes share `data/kitchen.sqlite`.

Mention the bot, or send it a direct message, after the workspace id is saved on that business. The agent replies with the workspace id when it is not saved yet.

## Seeded sample data

The first launch inserts sample content you can edit or delete:

- Business name **North Bowl** and about copy for a meal prep kitchen
- A weekly portioned menu (breakfasts, mains, sides) with one sold-out meal
- Company **Sample Studio Co.** and three sample customers (555 numbers and `.example` emails)

## Scripts

- `npm run dev` — development server on port 43123
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — production server on port 43123
