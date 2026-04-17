import { supabase, upsertChunks, ChunkRow } from '../lib/supabase';
import { chunkText } from '../utils/chunker';
import { MmpName } from '../types';

const PAGE_SIZE = 100;

async function backfillChunks(): Promise<void> {
  console.log('=== 기존 documents → chunks 변환 시작 ===');

  let page = 0;
  let totalDocs = 0;
  let totalChunks = 0;

  while (true) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, content, url, mmp_name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('id');

    if (error) throw new Error(`documents 조회 실패: ${error.message}`);
    if (!data || data.length === 0) break;

    const chunkRows: ChunkRow[] = [];
    for (const doc of data) {
      for (const chunk of chunkText(doc.content)) {
        chunkRows.push({
          document_id: doc.id,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          url: doc.url,
          title: doc.title,
          mmp_name: doc.mmp_name as MmpName,
        });
      }
    }

    await upsertChunks(chunkRows);
    totalDocs += data.length;
    totalChunks += chunkRows.length;
    console.log(`  페이지 ${page + 1}: 문서 ${data.length}건 → 청크 ${chunkRows.length}건`);

    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`\n=== 완료: 총 ${totalDocs}건 문서 → ${totalChunks}건 청크 ===`);
}

backfillChunks().catch(err => {
  console.error(err);
  process.exit(1);
});
