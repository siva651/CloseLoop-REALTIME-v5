# CloseLoop — AI Operations Autopilot

A serious, data-driven automation product for invoice reconciliation, exception management, approval, reporting, and AI-assisted operational decisions.

## Run

1. Put one or more provider keys in `.env.local`.
2. Restart the dev server after changing `.env.local`.
3. Run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Providers

- `OPENROUTER_API_KEY` — primary; defaults to `openrouter/free`.
- `REQUESTY_API_KEY` + `REQUESTY_MODEL` — optional.
- `XKIRO_API_KEY` — optional; if `XKIRO_MODEL` is empty, CloseLoop discovers a free model from xKiro's public catalog.

## Data

Upload a CSV containing some/all of: `customer`, `invoice_id`, `invoice_amount`, `paid_amount`, `invoice_date`, `due_date`, `payment_date`, `payment_ref`, `status`.

The deterministic reconciliation engine remains usable without AI. AI is used for the Copilot, operator brief, and follow-up drafting.
