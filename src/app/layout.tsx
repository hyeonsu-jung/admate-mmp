import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const noto = Noto_Sans_KR({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    variable: '--font-noto'
});

export const metadata: Metadata = {
    title: 'AdMate MMP - RAG Chatbot',
    description: 'APPSFLYER, AIRBRIDGE, ADJUST 데이터 기반 RAG 챗봇',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" className={`${inter.variable} ${noto.variable}`}>
            <body className="font-sans">{children}</body>
        </html>
    );
}
