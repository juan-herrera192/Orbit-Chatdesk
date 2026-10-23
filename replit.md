# Orbit Home · Chat Support

A call-center workspace for agents handling up to two simultaneous customer chats, graduated from the approved canvas design.

## Run & Operate

- Managed workflows: `artifacts/api-server: API Server` and `artifacts/orbit-home: web`.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/src/orbit.test.ts` — backend integration checks (disposable records, cleaned afterward).
- Authentication uses Replit-managed Clerk. Database and auth configuration are supplied through workspace secrets.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: generated Zod schemas from OpenAPI
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/orbit-home`: functional web app.
- `artifacts/mockup-sandbox`: preserved visual reference; do not overwrite when editing the functional app.
- `artifacts/api-server/src/routes/orbit.ts`: authenticated and public customer APIs.
- `artifacts/api-server/src/lib/orbit-*`: workspace storage and actions.
- `lib/db/src/schema/orbit.ts`: PostgreSQL schema.
- `lib/api-spec/openapi.yaml`: API contract (JSON is valid YAML).

## Architecture decisions

- New authenticated users get an isolated workspace. Joining an existing team requires the owner's revocable invitation code. This avoids exposing customer data to arbitrary signups.
- All invited staff are trusted to view the team's conversations; role labels select internal inboxes, not administrative authority. Only the workspace owner manages articles, order records and invitation codes.
- Workspace-level transactions serialize mutations to enforce the two-active-chat limit and prevent lost messages. Notes additionally use optimistic versions so another session cannot silently overwrite edits.
- Polling refreshes shared state every two seconds. Idle timing uses server timestamps, not browser-only counters.
- Customer chat access uses a high-entropy capability token, stored only as a hash on the server. Public responses strip internal notes and classifications.

## Product

- Agent access, team invitations, customer chat portal, queue/claim/open/send/close, per-customer notes and dispositions.
- Real monthly metrics from conversation outcomes and customer ratings; no fabricated performance data.
- Searchable knowledge base and manually maintained order tracking. Neither transport carriers nor external messaging providers are connected.
- Internal role inboxes for Supervisor, Manager, QA and HR. No external email delivery.
- Attachments are not supported in this first implementation; do not simulate uploads with filenames.

## User preferences

- Preserve the selected canvas design: solid navy/slate surfaces, cream customer bubbles, brass accents and curved conversation tails.
- Conversation selection belongs only in the left list. Do not restore browser-style tabs or glass effects.

## Gotchas

- Orval-generated fetch helpers need `dom.iterable` in the API client's TypeScript libs; configure React Query v5 explicitly.
- Do not overwrite unsaved note drafts during polling. On a version conflict, retain the draft and let the agent reload/resolve.
- Production schema changes use the platform Publish flow, never startup-time DDL.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
