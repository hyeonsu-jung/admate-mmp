import ChatInterface from '@/components/chat/ChatInterface';

export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-body">
            <div className="w-full max-w-5xl space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-extrabold tracking-tight text-gradient-premium">
                        AdMate MMP
                    </h1>
                    <p className="text-gray-400 text-lg">
                        고도화된 RAG 엔진 기반의 MMP 기술 지원 에이전트
                    </p>
                </div>

                <ChatInterface />
            </div>
        </main>
    );
}
