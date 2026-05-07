import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, validateEnv } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

// Validate environment variables
validateEnv();

const app = express();

// ===========================================
// Security Middleware
// ===========================================

// Manual CORS headers for ALL requests (Vercel serverless compatibility)
app.use((req, res, next) => {
  const allowedOrigins = env.corsOrigin.split(',').map((o) => o.trim());
  const origin = req.headers.origin;

  // Debug log for Vercel function logs (remove after CORS is confirmed working)
  if (req.method === 'OPTIONS') {
    console.log('[CORS Debug]', { origin, allowedOrigins, method: req.method });
  }

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

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
