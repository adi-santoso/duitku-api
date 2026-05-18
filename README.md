# DuitKu API

Backend API untuk aplikasi [DuitKu](https://github.com/adi-santoso/duitku) — Personal Finance Manager.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 5
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM + Drizzle Kit
- **Auth**: Custom JWT + bcrypt
- **Validation**: Zod
- **Deployment**: Vercel Serverless

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon recommended; any Postgres 14+ works)

### Installation

```bash
git clone https://github.com/adi-santoso/duitku-api.git
cd duitku-api
npm install
```

### Environment Variables

Copy `.env.example` ke `.env` dan isi:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (Neon pooler URL recommended) |
| `JWT_SECRET` | Secret untuk sign JWT (min 32 karakter) |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `PORT` | Server port (default: `3000`) |
| `CORS_ORIGIN` | Allowed frontend origin (comma-separated) |

### Database Setup

Apply migrations dan seed default categories:

```bash
npm run db:migrate    # apply Drizzle migrations to DATABASE_URL
npm run db:seed       # insert 15 default categories
```

Drizzle commands:

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate SQL migration dari perubahan schema |
| `npm run db:migrate` | Apply migrasi ke database |
| `npm run db:push` | Push schema langsung tanpa migration file (dev only) |
| `npm run db:studio` | Buka Drizzle Studio (GUI) di browser |
| `npm run db:seed` | Seed default categories |

### Run Development Server

```bash
npm run dev
```

Server berjalan di `http://localhost:3000`.

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Register owner |
| POST | `/api/auth/login` | - | Login (owner/staff) |
| GET | `/api/auth/me` | Bearer | Get current user |

### Staff (Owner Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/staff` | Bearer | List staff |
| POST | `/api/staff` | Bearer | Create staff |
| DELETE | `/api/staff/:id` | Bearer | Remove staff |

### Transactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/transactions` | Bearer | List (with filters) |
| GET | `/api/transactions/summary` | Bearer | Income/expense summary |
| POST | `/api/transactions` | Bearer | Create |
| PUT | `/api/transactions/:id` | Bearer | Update |
| DELETE | `/api/transactions/:id` | Bearer | Delete |

### Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | Bearer | List (default + custom) |
| POST | `/api/categories` | Bearer | Create custom |
| PUT | `/api/categories/:id` | Bearer | Update custom |
| DELETE | `/api/categories/:id` | Bearer | Delete custom |

### Budgets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/budgets` | Bearer | List all |
| POST | `/api/budgets` | Bearer | Create |
| PUT | `/api/budgets/:id` | Bearer | Update |
| DELETE | `/api/budgets/:id` | Bearer | Delete |

### Savings Goals

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/savings-goals` | Bearer | List all goals |
| GET | `/api/savings-goals/:id` | Bearer | Get goal detail |
| POST | `/api/savings-goals` | Bearer | Create goal |
| PUT | `/api/savings-goals/:id` | Bearer | Update goal |
| DELETE | `/api/savings-goals/:id` | Bearer | Delete goal |
| GET | `/api/savings-goals/:id/contributions` | Bearer | List contributions |
| POST | `/api/savings-goals/:id/contributions` | Bearer | Add contribution |

### Health Check

```
GET /api/health
```

## Response Format

```json
// Success
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}

// Error
{
  "success": false,
  "error": "Error description"
}
```

## Architecture

```
Frontend (Vue.js) → Backend (Express/TS + Drizzle) → Neon PostgreSQL
                    ├── JWT Auth (custom, bcrypt)
                    └── Role-based access (owner/staff)
```

### Owner vs Staff

- **Owner**: Register sendiri, memiliki semua data.
- **Staff**: Dibuat oleh owner, akses CRUD penuh ke data owner.
- JWT payload berisi `ownerId` — semua query data menggunakan ini.

## Scripts

```bash
npm run dev      # Dev server (hot reload)
npm run build    # Compile TypeScript
npm run start    # Run compiled JS
npm run lint     # Type check
```

## Deployment (Vercel)

1. Push ke GitHub
2. Import di [vercel.com/new](https://vercel.com/new)
3. Set environment variables (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`)
4. Deploy

## Security

- Helmet (security headers)
- CORS (restricted origins)
- Rate limiting (auth endpoints)
- bcrypt (password hashing, 12 rounds)
- Zod (input validation)
- JWT (stateless auth with expiry)
- Parametrized SQL via Drizzle (prevents injection)

## License

ISC
