import { createClient } from '@supabase/supabase-js';
import { MmpDocument, MmpName } from '../types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 50;

export async function upsertDocuments(docs: MmpDocument[]): Promise<Map<string, number>> {
  if (docs.length === 0) return new Map();

  // url → id 매핑 반환 (청킹에서 document_id 참조용)
  const urlToId = new Map<string, number>();

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('documents')
      .upsert(batch, { onConflict: 'url' })
      .select('id, url');

    if (error) {
      throw new Error(`Supabase upsert 실패 (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`);
    }

    for (const row of data ?? []) {
      urlToId.set(row.url, row.id);
    }

    console.log(`  → ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length} 건 저장 완료`);
  }

  return urlToId;
}

export interface ChunkRow {
  document_id: number;
  chunk_index: number;
  content: string;
  url: string;
  title: string;
  mmp_name: MmpName;
}

export async function upsertChunks(chunks: ChunkRow[]): Promise<void> {
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('chunks')
      .upsert(batch, { onConflict: 'document_id,chunk_index' });

    if (error) {
      throw new Error(`chunks upsert 실패 (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`);
    }

    console.log(`  → chunks ${Math.min(i + BATCH_SIZE, chunks.length)} / ${chunks.length} 건 저장 완료`);
  }
}
