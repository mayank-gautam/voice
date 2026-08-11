# VoiceAI Observability

Next.js App Router dashboard for Voice AI observability.

## Getting started

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the Next.js development server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint

## Auth proxy

`proxy.ts` protects all routes except `/login`, `/sso`, and auth/AWS public APIs. Login creates an encrypted `aws_sso_session` cookie; logout clears it.

## Twilio / AWS BFF APIs

Encrypted project credentials live in `.data/projects.json` (set `CREDENTIALS_SECRET` in `.env`).

| Route | Purpose |
|-------|---------|
| `GET/POST /api/projects` | List / create projects |
| `PUT/DELETE /api/projects/[id]` | Update / delete |
| `POST /api/projects/[id]/activate` | Set active project cookie |
| `GET /api/calls` | Twilio call list |
| `GET /api/calls/[id]` | Single call |
| `GET /api/calls/[id]/telephony` | Voice Insights → telephony charts |
| `GET /api/calls/[id]/recording?proxy=1` | Recording audio proxy |
| `GET /api/calls/[id]/logs` | CloudWatch logs for Call SID |

## Project structure

- `src/app` — Next.js App Router routes and root layout
- `src/views` — client page components (imported by app routes)
- `src/components` — UI and dashboard components
- `src/lib` — utilities and mock data
- `proxy.ts` — route protection (Next.js 16 proxy)
