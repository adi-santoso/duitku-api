import express from 'express';
import cors from 'cors';
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

// CORS: Allow frontend origin (must be before helmet and other middleware)
app.use(
  cors({
    origin: env.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Explicitly handle preflight OPTIONS for all routes
app.options('*', cors());

// Helmet: Set security HTTP headers
app.use(helmet());

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
