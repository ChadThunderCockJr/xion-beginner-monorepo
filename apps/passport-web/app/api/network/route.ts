// GET /api/network - Get LAN IP for mobile QR code scanning
import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
    // In production on Vercel, return the stable project URL (not the deployment-specific URL,
    // which has deployment protection and blocks unauthenticated API calls from the iOS app)
    if (process.env.VERCEL) {
        const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
        return NextResponse.json({
            lanIp: host,
            frontendUrl: `https://${host}`,
            isProduction: true,
        });
    }

    // In development, find LAN IP for mobile testing
    const interfaces = os.networkInterfaces();
    let lanIp = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                lanIp = iface.address;
                break;
            }
        }
        if (lanIp !== 'localhost') break;
    }

    return NextResponse.json({
        lanIp,
        port: 3000,
        frontendUrl: `http://${lanIp}:3000`,
        isProduction: false,
    });
}
