# DuitKu API - Backend Service

## Project Overview
Backend API untuk aplikasi DuitKu (Personal Finance Manager). Menangani autentikasi, manajemen staff, transaksi, kategori, anggaran, dan target tabungan.

## Tech Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js 5
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (Neon, accessed via `@neondatabase/serverless`)
- **ORM**: Drizzle ORM + Drizzle Kit
- **Auth**: Custom JWT (bcryptjs + jsonwebtoken)
- **Validation**: Zod
- **Security**: Helmet, CORS, express-rate-limit
- **Deployment**: Vercel Serverless Functions

## Architecture

```
Frontend (Vue.js) → Backend (Express/TS + Drizzle) → Neon PostgreSQL
                    ├── JWT Auth (custom, bcrypt)
                    └── Role-based access (owner/staff)
```

### Key Concepts
- **Owner**: User yang register sendiri. Semua data milik owner.
- **Staff**: Akun yang dibuat owner. Staff akses data owner (CRUD penuh).
- **ownerId**: Semua data query menggunakan `ownerId` dari JWT payload.
  - Jika owner login → ownerId = userId sendiri
  - Jika staff login → ownerId = owner's userId

## Folder Structure
```
duitku-api/
├── src/
│   ├── config/
│   │   ├── env.ts           # Environment variables & validation
│   │   └── database.ts      # Drizzle client (Neon serverless pool)
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema (tables, indexes, constraints)
│   │   ├── migrate.ts       # Migration runner (applies /drizzle SQL)
│   │   └── seed.ts          # Seed default categories
│   ├── middleware/
│   │   ├── auth.ts          # JWT verification & role guards
│   │   ├── errorHandler.ts  # Global error & 404 handler
│   │   └── validate.ts      # Zod validation middleware
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── staff.routes.ts
│   │   ├── transaction.routes.ts
│   │   ├── category.routes.ts
│   │   ├── budget.routes.ts
│   │   └── savings-goal.routes.ts
│   ├── services/            # Business logic per domain (Drizzle queries)
│   ├── types/
│   ├── utils/
│   └── index.ts
├── drizzle/                 # Generated SQL migrations + snapshots
├── scripts/
│   └── migrate-from-supabase.ts  # One-time data migration helper
├── archive/                 # Legacy Supabase SQL (kept for reference)
├── drizzle.config.ts
├── package.json
└── vercel.json
```

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register owner account |
| POST | /api/auth/login | No | Login (owner or staff) |
| GET | /api/auth/me | Yes | Get current user info |

### Staff (Owner Only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/staff | Owner | List all staff |
| POST | /api/staff | Owner | Create staff account |
| DELETE | /api/staff/:id | Owner | Remove staff |

### Transactions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/transactions | Yes | List with filters |
| GET | /api/transactions/summary | Yes | Income/expense summary |
| POST | /api/transactions | Yes | Create transaction |
| PUT | /api/transactions/:id | Yes | Update transaction |
| DELETE | /api/transactions/:id | Yes | Delete transaction |

### Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/categories | Yes | List (default + custom) |
| POST | /api/categories | Yes | Create custom category |
| PUT | /api/categories/:id | Yes | Update custom category |
| DELETE | /api/categories/:id | Yes | Delete custom category |

### Budgets
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/budgets | Yes | List all budgets |
| POST | /api/budgets | Yes | Create budget |
| PUT | /api/budgets/:id | Yes | Update budget |
| DELETE | /api/budgets/:id | Yes | Delete budget |

### Savings Goals
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/savings-goals | Yes | List goals |
| GET | /api/savings-goals/:id | Yes | Get goal detail |
| POST | /api/savings-goals | Yes | Create goal |
| PUT | /api/savings-goals/:id | Yes | Update goal |
| DELETE | /api/savings-goals/:id | Yes | Delete goal |
| GET | /api/savings-goals/:id/contributions | Yes | List contributions |
| POST | /api/savings-goals/:id/contributions | Yes | Add contribution |

## API Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error
```json
{
  "success": false,
  "error": "Error description"
}
```

## Database

Schema defined as TypeScript in `src/db/schema.ts` (Drizzle). SQL migrations are generated into `/drizzle`.

### Tables
- `app_users` — owner & staff accounts (replaces former Supabase Auth)
- `categories` — default (`is_default = true`, `user_id NULL`) + per-owner custom
- `transactions` — references `app_users.id` (owner) and `categories.id`
- `budgets` — one per (owner, category)
- `savings_goals` — long-term saving targets
- `savings_contributions` — deposit history per goal

### Key constraints
- `app_users` CHECK: owner has `owner_id IS NULL`, staff has `owner_id IS NOT NULL`.
- `transactions.amount >= 0`, `budgets.amount > 0`, `savings_goals.target_amount > 0`.
- All FKs cascade on owner delete; `transactions.category_id` is `ON DELETE RESTRICT`.

### Database Commands
```bash
npm run db:generate     # Generate SQL migration from schema changes
npm run db:migrate      # Apply migrations to DATABASE_URL
npm run db:push         # Push schema directly (dev convenience)
npm run db:studio       # Open Drizzle Studio
npm run db:seed         # Seed 15 default categories
```

### One-time Supabase → Neon migration
```bash
# Set both DATABASE_URL (Neon) and SUPABASE_CONNECTION_STRING in .env
npm run data:migrate-from-supabase
```

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Postgres connection string (Neon pooler URL recommended) |
| JWT_SECRET | Yes | Secret for signing JWT tokens (min 32 chars) |
| JWT_EXPIRES_IN | No | Token expiry (default: 7d) |
| PORT | No | Server port (default: 3000) |
| NODE_ENV | No | Environment (default: development) |
| CORS_ORIGIN | No | Allowed origins, comma-separated |
| RATE_LIMIT_WINDOW_MS | No | Rate limit window (default 15 min) |
| RATE_LIMIT_MAX | No | Max requests per window (default 100) |
| SUPABASE_CONNECTION_STRING | No | Only for one-time data migration script |

## Development Commands
```bash
npm run dev      # Start dev server with hot reload (tsx watch)
npm run build    # Compile TypeScript to dist/
npm run start    # Run compiled JS
npm run lint     # Type check without emitting
```

## Security Measures
1. **Helmet** — Security HTTP headers
2. **CORS** — Restricted to frontend origin
3. **Rate Limiting** — On auth endpoints (100 req / 15 min)
4. **JWT** — Stateless authentication with expiry
5. **bcrypt** — Password hashing (12 salt rounds)
6. **Zod** — Input validation on all endpoints
7. **Parametrized SQL via Drizzle** — Prevents injection
8. **Role guards** — Staff cannot manage other staff

## Code Style
1. Use async/await (no callbacks)
2. All exported functions have JSDoc comments
3. Error messages in Bahasa Indonesia (user-facing)
4. Console logs in English (developer-facing)
5. Strict TypeScript — no `any` types
6. Single responsibility per file
7. Services contain business logic; routes handle HTTP

## Deployment (Vercel)
1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`)
3. Vercel auto-detects `vercel.json` config
4. All routes handled by `src/index.ts` serverless function
5. The `@neondatabase/serverless` driver uses HTTP/WebSocket — works inside Vercel serverless without connection-pool issues

## Notes
- Numeric columns (`amount`, `target_amount`, etc.) are returned as strings by Drizzle (Postgres `numeric`). Convert with `Number(value)` when arithmetic is required.
- Frontend treats backend as the only data source; there are no direct database calls from the client.
- When schema changes, regenerate migrations with `npm run db:generate` and commit the new SQL file in `/drizzle`.
