import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_EMBEDDING_API_KEY });

const MODEL = 'text-embedding-3-large';
const BATCH_SIZE = 100;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await client.embeddings.create({ model: MODEL, input: texts });
      return res.data.map(d => d.embedding);
    } catch (err: any) {
      if (attempt === RETRY_LIMIT) throw err;
      const isRateLimit = err?.status === 429;
      const delay = isRateLimit ? RETRY_DELAY_MS * attempt * 3 : RETRY_DELAY_MS;
      console.warn(`  임베딩 재시도 (${attempt}/${RETRY_LIMIT}) ${delay}ms 대기...`);
      await sleep(delay);
    }
  }
  return [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch);
    results.push(...embeddings);
    if (i + BATCH_SIZE < texts.length) await sleep(200);
  }
  return results;
}
