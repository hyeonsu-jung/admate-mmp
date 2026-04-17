import { supabase } from '../lib/supabase';
import { embedTexts } from '../lib/embeddings';

const PAGE_SIZE = 100;

async function embedChunks(): Promise<void> {
  console.log('=== chunks 임베딩 생성 시작 ===');

  let totalProcessed = 0;
  let page = 0;

  while (true) {
    // embedding이 없는 청크만 조회
    const { data, error } = await supabase
      .from('chunks')
      .select('id, content')
      .is('embedding', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('id');

    if (error) throw new Error(`chunks 조회 실패: ${error.message}`);
    if (!data || data.length === 0) break;

    console.log(`\n페이지 ${page + 1}: ${data.length}건 임베딩 생성 중...`);

    const texts = data.map(c => c.content);
    const embeddings = await embedTexts(texts);

    // 청크별 embedding 업데이트
    for (let i = 0; i < data.length; i++) {
      const { error: updateErr } = await supabase
        .from('chunks')
        .update({ embedding: JSON.stringify(embeddings[i]) })
        .eq('id', data[i].id);

      if (updateErr) {
        console.warn(`  chunk id=${data[i].id} 업데이트 실패: ${updateErr.message}`);
      }
    }

    totalProcessed += data.length;
    console.log(`  누적 처리: ${totalProcessed}건`);

    // embedding이 null인 것만 조회하므로 page는 항상 0
  }

  console.log(`\n=== 완료: 총 ${totalProcessed}건 임베딩 생성 ===`);
}

embedChunks().catch(err => {
  console.error(err);
  process.exit(1);
});
