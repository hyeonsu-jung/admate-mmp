import { OpenAI } from 'openai';
import { supabase } from '../supabase';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_EMBEDDING_API_KEY,
});

export interface SearchResult {
    id: number;
    title: string;
    content: string;
    url: string;
    mmp_name: string;
    similarity: number;
}

export class RAGService {
    /**
     * 텍스트를 임베딩 벡터로 변환 (OpenAI)
     */
    static async generateEmbedding(text: string): Promise<number[]> {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
    }

    /**
     * Supabase Vector Search 수행
     */
    static async searchSimilarChunks(query: string, mmpName?: string, limit: number = 5): Promise<SearchResult[]> {
        const embedding = await this.generateEmbedding(query);

        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_count: limit,
            filter_mmp: mmpName || null,
        });

        if (error) {
            console.error('Vector Search Error:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * 검색된 컨텍스트를 바탕으로 답변 생성 프롬프트 구성
     */
    static buildPrompt(query: string, results: SearchResult[]): string {
        const context = results
            .map((r, i) => `[자료 ${i + 1}] (${r.mmp_name}) ${r.title}\nURL: ${r.url}\n내용: ${r.content}`)
            .join('\n\n');

        return `
당신은 MMP(Mobile Measurement Partner) 전문가 AI 어시스턴트인 'AdMate-MMP'입니다.
제공된 참고 자료만을 바탕으로 사용자의 질문에 답변하세요.

[참고 자료]
${context || '검색된 관련 자료가 없습니다.'}

[사용자 질문]
${query}

[지침]
1. 답변은 한국어로 정중하게 작성하세요.
2. 반드시 제공된 [참고 자료]에 근거하여 답변하세요. 자료에 없는 내용은 모른다고 답변하세요.
3. 답변 끝에 참고한 자료의 원문 URL을 "참고 출처:" 섹션에 나열하세요.
4. 가능한 구체적이고 기술적인 내용을 포함하세요 (SDK 설정, API 가이드 등).
5. 마크다운 형식을 사용하여 가독성 있게 작성하세요.
`;
    }
}
