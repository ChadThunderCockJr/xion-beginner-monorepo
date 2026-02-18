// Paywall Passport Backend API Server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sessionRoutes from './routes/session.js';
import verifyRoutes from './routes/verify.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'paywall-passport-api',
        timestamp: new Date().toISOString()
    });
});

// Get local network info for mobile QR scanning
app.get('/api/network', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let lanIp = 'localhost';

    // Find the first non-internal IPv4 address
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                lanIp = iface.address;
                break;
            }
        }
        if (lanIp !== 'localhost') break;
    }

    res.json({
        lanIp,
        port: process.env.PORT || 3001,
        frontendPort: 3000,
        frontendUrl: `http://${lanIp}:3000`
    });
});

// API Routes
app.use('/api/session', sessionRoutes);
app.use('/api/verify', verifyRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                 PAYWALL PASSPORT API                      ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                  ║
║  Frontend URL: ${FRONTEND_URL.padEnd(38)}║
║                                                           ║
║  Endpoints:                                               ║
║    POST /api/session/create    - Create TV session        ║
║    GET  /api/session/:id/status - Get session status      ║
║    POST /api/session/:id/demo-verify - Demo mode          ║
║    POST /api/verify/callback   - Reclaim callback         ║
║                                                           ║
║  Health: GET /health                                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
