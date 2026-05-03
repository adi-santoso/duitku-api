# DuitKu API - Backend Service

## Project Overview
Backend API untuk aplikasi DuitKu (Personal Finance Manager). Menangani autentikasi, manajemen staff, transaksi, kategori, dan anggaran.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Language**: TypeScript (strict mode)
- **Database**: Supabase PostgreSQL (accessed via service_role key, bypasses RLS)
- **Auth**: Custom JWT (bcryptjs + jsonwebtoken)
- **Validation**: Zod
- **Security**: Helmet, CORS, express-rate-limit
- **Deployment**: Vercel Serverless Functions

## Architecture

```
Frontend (Vue.js) → Backend (Express/TS) → Supabase PostgreSQL
                    ├── JWT Auth (custom)
                    ├── Role-based access (owner/staff)
                    └── service_role key (bypasses RLS)
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
│   │   ├── env.ts          # Environment variables & validation
│   │   └── database.ts     # Supabase client (service_role)
│   ├── middleware/
│   │   ├── auth.ts         # JWT verification & role guards
│   │   ├── errorHandler.ts # Global error & 404 handler
│   │   └── validate.ts     # Zod validation middleware
│   ├── routes/
│   │   ├── index.ts        # Route aggregator
│   │   ├── auth.routes.ts  # POST /register, /login, GET /me
│   │   ├── staff.routes.ts # CRUD staff (owner only)
│   │   ├── transaction.routes.ts
│   │   ├── category.routes.ts
│   │   └── budget.routes.ts
│   ├── services/
│   │   ├── auth.service.ts       # Register, login logic
│   │   ├── staff.service.ts      # Staff CRUD
│   │   ├── transaction.service.ts
│   │   ├── category.service.ts
│   │   └── budget.service.ts
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces & types
│   ├── utils/
│   │   ├── jwt.ts          # Token generate & verify
│   │   ├── password.ts     # bcrypt hash & compare
│   │   ├── response.ts     # Standardized API responses
│   │   └── validation.ts   # Zod schemas
│   └── index.ts            # App entry point
├── sql/
│   ├── 001_create_app_users.sql  # New users table
│   └── 002_migrate_existing_data.sql
├── .env.example
├── .gitignore
├── CLAUDE.md
├── package.json
├── tsconfig.json
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

## Database Schema

### app_users (NEW - replaces Supabase Auth)
```sql
CREATE TABLE app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  owner_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Existing tables (unchanged)
- `transactions` — user_id references the owner's app_users.id
- `categories` — user_id references the owner's app_users.id
- `budgets` — user_id references the owner's app_users.id

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key (bypasses RLS) |
| JWT_SECRET | Yes | Secret for signing JWT tokens |
| JWT_EXPIRES_IN | No | Token expiry (default: 7d) |
| PORT | No | Server port (default: 3000) |
| NODE_ENV | No | Environment (default: development) |
| CORS_ORIGIN | No | Allowed origins (default: http://localhost:3001) |

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
3. **Rate Limiting** — On auth endpoints (100 req/15min)
4. **JWT** — Stateless authentication with expiry
5. **bcrypt** — Password hashing (12 salt rounds)
6. **Zod** — Input validation on all endpoints
7. **service_role** — Backend-only DB access (never exposed to frontend)
8. **Role guards** — Staff cannot manage other staff

## Code Style
1. Use async/await (no callbacks)
2. All functions have JSDoc comments
3. Error messages in Bahasa Indonesia (user-facing)
4. Console logs in English (developer-facing)
5. Strict TypeScript — no `any` types
6. Single responsibility per file
7. Services contain business logic, routes handle HTTP

## Deployment (Vercel)
1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Vercel auto-detects `vercel.json` config
4. All routes handled by `src/index.ts` serverless function

## Git Commit Convention
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- docs: Documentation
- chore: Maintenance
- security: Security improvements

## Notes
- Database accessed via Supabase service_role key (bypasses all RLS)
- All access control is handled in application layer (middleware)
- Staff and owner share the same login endpoint
- JWT payload contains `ownerId` which determines data access scope
- Frontend needs to be updated to use this API instead of direct Supabase calls
