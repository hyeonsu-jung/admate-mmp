import { MmpDocument, RawArticle } from '../types';
import { extractText, isValidContent } from '../utils/html-parser';
import { upsertDocuments, upsertChunks, ChunkRow } from '../lib/supabase';
import { chunkText } from '../utils/chunker';

const BASE_API = 'https://support.appsflyer.com/api/v2/help_center/ko';
const PER_PAGE = 30;
const RATE_LIMIT_MS = 300;

interface ZendeskArticle {
  id: number;
  html_url: string;
  title: string;
  body: string;
  section_id: number;
  locale: string;
  updated_at: string;
  outdated: boolean;
}

interface ZendeskResponse {
  articles: ZendeskArticle[];
  page: number;
  next_page: string | null;
  page_count: number;
  count: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(page: number): Promise<ZendeskResponse> {
  const url = `${BASE_API}/articles.json?page=${page}&per_page=${PER_PAGE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AppsFlyer API 오류 (page ${page}): ${res.status} ${res.statusText}`);
  return res.json() as Promise<ZendeskResponse>;
}

export async function crawlAppsFlyer(): Promise<RawArticle[]> {
  console.log('[AppsFlyer] 크롤링 시작...');

  const firstPage = await fetchPage(1);
  const totalPages = firstPage.page_count;
  console.log(`[AppsFlyer] 총 ${firstPage.count}건 / ${totalPages}페이지`);

  const articles: RawArticle[] = [];

  const processPage = (data: ZendeskResponse) => {
    for (const article of data.articles) {
      if (article.outdated) continue;
      articles.push({
        title: article.title,
        body: article.body,
        url: article.html_url,
        mmp_name: 'AppsFlyer',
        section_id: article.section_id,
        updated_at: article.updated_at,
      });
    }
  };

  processPage(firstPage);

  for (let page = 2; page <= totalPages; page++) {
    await sleep(RATE_LIMIT_MS);
    const data = await fetchPage(page);
    processPage(data);
    console.log(`[AppsFlyer] ${page}/${totalPages} 페이지 수집 (누적: ${articles.length}건)`);
  }

  console.log(`[AppsFlyer] 수집 완료: ${articles.length}건`);
  return articles;
}

export async function crawlAndSaveAppsFlyer(): Promise<void> {
  const raw = await crawlAppsFlyer();
  const crawled_at = new Date().toISOString();

  const docs: MmpDocument[] = raw
    .map(a => ({
      title: a.title,
      content: extractText(a.body),
      url: a.url,
      mmp_name: a.mmp_name,
      section_id: a.section_id,
      updated_at: a.updated_at,
      crawled_at,
    }))
    .filter(d => isValidContent(d.content));

  console.log(`[AppsFlyer] 품질 필터 후: ${docs.length}건 → documents 저장 시작`);
  const urlToId = await upsertDocuments(docs);

  // 청킹
  const chunkRows: ChunkRow[] = [];
  for (const doc of docs) {
    const docId = urlToId.get(doc.url);
    if (!docId) continue;
    for (const chunk of chunkText(doc.content)) {
      chunkRows.push({
        document_id: docId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        url: doc.url,
        title: doc.title,
        mmp_name: doc.mmp_name,
      });
    }
  }

  console.log(`[AppsFlyer] 청크 생성: ${chunkRows.length}건 → chunks 저장 시작`);
  await upsertChunks(chunkRows);
  console.log('[AppsFlyer] 완료');
}

if (require.main === module) {
  crawlAndSaveAppsFlyer().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
