import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, validateEnv } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// ===========================================
// CORS - MUST be first middleware (before anything else)
// ===========================================

app.use((req, res, next) => {
  // Always set CORS headers regardless of anything else
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://duitku-indol.vercel.app',
    'http://localhost:3001',
    'http://localhost:5173',
  ];

  // Also check env-based origins
  if (env.corsOrigin) {
    env.corsOrigin.split(',').map((o) => o.trim()).forEach((o) => {
      if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
    });
  }

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // Fallback: allow the production frontend always
    res.setHeader('Access-Control-Allow-Origin', 'https://duitku-indol.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight immediately - return before any other middleware
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

// Validate environment variables (after CORS so preflight always works)
validateEnv();

// Helmet: Set security HTTP headers (with CORS-safe config)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  crossOriginEmbedderPolicy: false,
}));

// Rate Limiting: Prevent brute force
const limiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  message: {
    success: false,
    error: 'Terlalu banyak request. Coba lagi nanti.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', limiter);

// ===========================================
// Body Parsing
// ===========================================

app.use(express.json({ limit: '5mb' })); // 5mb for receipt images
app.use(express.urlencoded({ extended: true }));

// ===========================================
// Routes
// ===========================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    },
  });
});

// API routes
app.use('/api', routes);

// ===========================================
// Error Handling
// ===========================================

app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// Start Server (only in non-serverless mode)
// ===========================================

if (env.nodeEnv !== 'production') {
  app.listen(env.port, () => {
    console.log(`[Server] Running on http://localhost:${env.port}`);
    console.log(`[Server] Environment: ${env.nodeEnv}`);
  });
}

// Export for Vercel serverless
export default app;
