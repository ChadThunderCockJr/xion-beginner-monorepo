import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Paywall Passport',
    description: 'Privacy-preserving user verification platform.',
    keywords: ['age verification', 'CTV', 'privacy', 'Paywall Passport', 'Reclaim Protocol'],
    icons: {
        icon: '/favicon.ico',
        apple: '/apple-touch-icon.png',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
