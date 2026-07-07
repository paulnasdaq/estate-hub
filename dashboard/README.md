# Dashboard

Frontend for the housing application. Talks to the FastAPI backend in
[`../backend`](../backend).

## Stack

| Concern       | Tool                                             |
| ------------- | ------------------------------------------------ |
| Build/dev     | [Vite](https://vite.dev) + React 19 + TypeScript |
| Routing       | [TanStack Router](https://tanstack.com/router)   |
| Server state  | [TanStack Query](https://tanstack.com/query)     |
| Tables        | [TanStack Table](https://tanstack.com/table)     |
| API client    | [openapi-fetch](https://openapi-ts.dev) (typed from the backend's OpenAPI schema) |
| UI            | [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Forms         | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) |
| Tests         | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) + [MSW](https://mswjs.io) |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Requests to `/api/*` are proxied to the backend at `http://localhost:8000`
(see [vite.config.ts](vite.config.ts)), so run the backend alongside the dev
server. The proxy target is overridable with `VITE_PROXY_TARGET`.

### With Docker Compose

The dashboard is wired into the project compose stacks (from the repo root):

```bash
# Dev: hot-reloading Vite server on :5173, backend on :8000
docker compose -f docker-compose.dev.yml up --build

# Prod: static build served by nginx on :8080 (override with DASHBOARD_PORT)
docker compose -f docker-compose.prod.yml up --build -d
```

In the dev stack the Vite proxy targets the `backend` service; in prod, nginx
serves the static build and proxies `/api` to the backend, so the browser
always talks to a single origin.

## Project structure

Organized **package-by-feature**, mirroring the FastAPI backend: each feature
is a self-contained module, over a shared `core/`, composed by a thin `app/`.

```
src/
├── main.tsx              # entry point
├── app/                  # composition (≈ backend main.py + api.py)
│   ├── providers.tsx     #   global providers
│   ├── router.tsx        #   aggregates every feature's routes
│   └── routes.ts         #   root/layout route
├── core/                 # shared infrastructure (≈ app/core/)
│   ├── api/              #   openapi-fetch client, token, generated schema
│   ├── config.ts         #   typed env access
│   ├── errors.ts         #   error mapping
│   └── query-client.ts
├── components/
│   ├── ui/               # shadcn primitives
│   └── layout/           # app shell (sidebar)
├── lib/utils.ts          # cn(), formatters
├── features/             # one folder per backend feature
│   └── properties/       #   the reference example
│       ├── api/          #     Query hooks (≈ services/)
│       ├── components/   #     feature UI
│       ├── schemas.ts    #     Zod form schemas (≈ Pydantic schemas/)
│       ├── types.ts      #     domain types from the OpenAPI schema
│       ├── routes.tsx    #     route definitions (≈ routes.py)
│       ├── index.ts      #     public API barrel (≈ __init__.py)
│       └── properties.test.tsx
└── test/                 # shared test harness (≈ conftest.py)
    ├── setup.ts, test-utils.tsx
    └── msw/              #   typed mock API (handlers, server)
```

**Adding a feature:** copy `features/properties/`, rename, and register its
route in [src/app/router.tsx](src/app/router.tsx). Import other features only
through their `index.ts` barrel — never deep paths.

## Typed API client

The client in [src/core/api/client.ts](src/core/api/client.ts) is typed from the
backend's OpenAPI schema. Regenerate the types whenever the backend API
changes (backend must be running):

```bash
npm run gen:api    # writes src/core/api/schema.d.ts
```

Then use fully-typed requests, e.g.:

```ts
import { api } from "@/core/api/client";
const { data, error } = await api.GET("/api/v1/properties");
```

Auth: [src/core/api/token.ts](src/core/api/token.ts) holds an in-memory bearer
token and [client.ts](src/core/api/client.ts) attaches it to every request. Call
`setAccessToken()` after login once the backend `auth` endpoints exist.

## Testing

```bash
npm test              # watch mode
npm run test:run      # single run (CI)
npm run test:coverage # with coverage
```

Tests are **colocated** with the code they cover (`*.test.tsx`). The API is
mocked with [MSW](https://mswjs.io): handlers in
[src/test/msw/handlers.ts](src/test/msw/handlers.ts) are typed against the same
OpenAPI schema as the client (via `openapi-msw`), so mocks can't drift from the
contract. Render components with the provider-wrapped `render` from
[src/test/test-utils.tsx](src/test/test-utils.tsx); override the API per-test
with `server.use(...)`. See
[features/properties/properties.test.tsx](src/features/properties/properties.test.tsx)
for the pattern.

## Adding UI components

shadcn/ui is configured ([components.json](components.json)). Add components with:

```bash
npx shadcn@latest add table dialog input   # etc.
```

## Scripts

| Command             | Does                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Start the dev server                    |
| `npm run build`     | Typecheck + production build            |
| `npm run preview`   | Preview the production build            |
| `npm run lint`      | Run ESLint                              |
| `npm run typecheck` | Typecheck without emitting              |
| `npm test`          | Run tests in watch mode                 |
| `npm run test:run`  | Run tests once                          |
| `npm run test:coverage` | Run tests with coverage             |
| `npm run gen:api`   | Regenerate API types from the backend   |
