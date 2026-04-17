import { OpenAI } from 'openai';
import { RAGService } from '@/lib/services/rag-service';
import { NextRequest } from 'next/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_EMBEDDING_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { messages, mmpName } = await req.json();
        const lastMessage = messages[messages.length - 1].content;

        // 1. 관련 컨텍스트 검색
        const searchResults = await RAGService.searchSimilarChunks(lastMessage, mmpName);

        // 2. 프롬프트 구성
        const prompt = RAGService.buildPrompt(lastMessage, searchResults);

        // 3. OpenAI Streaming 호출
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: '당신은 숙련된 광고 기술 전문가입니다.' },
                { role: 'user', content: prompt }
            ],
            stream: true,
        });

        // 4. 스트림 응답 생성
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                for await (const chunk of response) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        controller.enqueue(encoder.encode(content));
                    }
                }
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error: any) {
        console.error('Chat API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
