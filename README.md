# DuitKu API

Backend API untuk aplikasi [DuitKu](https://github.com/adi-santoso/duitku) — Personal Finance Manager.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Custom JWT + bcrypt
- **Validation**: Zod
- **Deployment**: Vercel Serverless

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (untuk PostgreSQL database)

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
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Settings → API) |
| `JWT_SECRET` | Secret untuk sign JWT (min 32 karakter) |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `PORT` | Server port (default: `3000`) |
| `CORS_ORIGIN` | Allowed frontend origin |

### Database Setup

Jalankan SQL berikut di **Supabase SQL Editor**:

```bash
# File: sql/001_create_app_users.sql
```

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
Frontend (Vue.js) → Backend (Express/TS) → Supabase PostgreSQL
                    ├── JWT Auth (custom)
                    ├── Role-based access (owner/staff)
                    └── service_role key (bypasses RLS)
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
3. Set environment variables
4. Deploy

## Security

- Helmet (security headers)
- CORS (restricted origins)
- Rate limiting (auth endpoints)
- bcrypt (password hashing, 12 rounds)
- Zod (input validation)
- JWT (stateless auth with expiry)
- service_role key (backend-only, never exposed)

## License

ISC
