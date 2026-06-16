# La Cuevita CRM

Production-ready MVP CRM for La Cuevita Furniture, built with Next.js App Router, TypeScript, Tailwind CSS, REST API routes, and PostgreSQL.

## Stores

- Hialeah: `786-748-9064`, `store_id = hialeah`
- SW: `305-801-9649`, `store_id = sw`

Incoming WhatsApp leads are routed only from the webhook `to_number`. There is no manual store assignment in the lead workflow.

## Quick Start

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL`.
4. Run `db/schema.sql`.
5. Install dependencies and start the app:

```bash
npm install
npm run dev
```

## Local Demo Logins

When `DATABASE_URL` is not set, the app runs in local demo mode with these accounts:

- Owner: `owner@lacuevitafurniture.com` / `Owner123!`
- Manager: `manager@lacuevitafurniture.com` / `Manager123!`
- Hialeah Sales: `hialeah.sales@lacuevitafurniture.com` / `Hialeah123!`
- SW Sales: `sw.sales@lacuevitafurniture.com` / `SW123!`

## Railway Deploy

1. Create a Railway project.
2. Add a PostgreSQL service.
3. Add this app as a Railway service from GitHub or uploaded source.
4. Set environment variables:
   - `DATABASE_URL` from the Railway PostgreSQL service
   - `AUTH_SECRET` as a long random string
   - `WHATSAPP_VERIFY_TOKEN`
   - `NEXT_PUBLIC_APP_NAME=La Cuevita CRM`
5. Deploy the app.
6. Run `npm run migrate` once against the app service after `DATABASE_URL` is set.
7. Use the generated Railway domain as the team login link.

## Key API Endpoints

- `POST /api/webhooks/whatsapp` - WhatsApp inbound webhook.
- `POST /api/messages/outbound` - Log salesperson outbound WhatsApp/contact activity.
- `GET /api/dashboard` - Owner, manager, and salesperson metrics.
- `GET /api/leads` - List leads.
- `PATCH /api/leads/:id` - Update lead fields or pipeline status.

## Test Payload

```json
{
  "to_number": "786-748-9064",
  "from_number": "+13055550123",
  "body": "Hi, I need a bedroom set",
  "name": "Maria Lopez",
  "message_id": "wamid.test-1",
  "source": "whatsapp"
}
```
