import { chromium } from 'playwright';
import { MmpDocument, RawArticle } from '../types';
import { extractText, isValidContent } from '../utils/html-parser';
import { upsertDocuments, upsertChunks, ChunkRow } from '../lib/supabase';
import { chunkText } from '../utils/chunker';

const BASE_URL = 'https://help.airbridge.io/ko';
const RATE_LIMIT_MS = 500;
const CONTENT_SELECTORS = ['main', 'article', '.article-body', '.content', '#content', '.help-content'];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isSameDomain(url: string, base: string): boolean {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    return u.href.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function isContentPage(url: string): boolean {
  return /\/(guides|developers|references|articles|ko)\/.+/.test(url);
}

export async function crawlAirbridge(): Promise<RawArticle[]> {
  console.log('[Airbridge] 크롤링 시작...');

  const browser = await chromium.launch({ headless: true });
  const visited = new Set<string>();
  const queue: string[] = [BASE_URL];
  const articles: RawArticle[] = [];

  try {
    while (queue.length > 0) {
      const rawUrl = queue.shift()!;
      const url = normalizeUrl(rawUrl);

      if (visited.has(url)) continue;
      visited.add(url);

      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // 본문 추출 — 선택자 순서대로 시도
        let content = '';
        for (const selector of CONTENT_SELECTORS) {
          content = await page.$eval(selector, el => (el as HTMLElement).innerHTML).catch(() => '');
          if (content) break;
        }

        if (content && isContentPage(url)) {
          const title = await page.title();
          articles.push({
            title: title.replace(' - Airbridge Help Center', '').trim(),
            body: content,
            url,
            mmp_name: 'Airbridge',
          });
          console.log(`[Airbridge] 수집: ${url} (${articles.length}건)`);
        }

        // 동일 도메인 링크 수집
        const links: string[] = await page.$$eval(
          'a[href]',
          (els, base) =>
            els
              .map(el => {
                try {
                  return new URL((el as HTMLAnchorElement).getAttribute('href')!, base).href;
                } catch {
                  return '';
                }
              })
              .filter(Boolean),
          'https://help.airbridge.io'
        );

        for (const link of links) {
          const norm = normalizeUrl(link);
          if (!visited.has(norm) && isSameDomain(norm, 'https://help.airbridge.io') && norm.includes('/ko')) {
            queue.push(norm);
          }
        }
      } catch (err) {
        console.warn(`[Airbridge] 페이지 오류 (${url}):`, (err as Error).message);
      } finally {
        await page.close();
      }

      await sleep(RATE_LIMIT_MS);
    }
  } finally {
    await browser.close();
  }

  console.log(`[Airbridge] 수집 완료: ${articles.length}건`);
  return articles;
}

export async function crawlAndSaveAirbridge(): Promise<void> {
  const raw = await crawlAirbridge();
  const crawled_at = new Date().toISOString();

  const docs: MmpDocument[] = raw
    .map(a => ({
      title: a.title,
      content: extractText(a.body),
      url: a.url,
      mmp_name: a.mmp_name,
      crawled_at,
    }))
    .filter(d => isValidContent(d.content));

  console.log(`[Airbridge] 품질 필터 후: ${docs.length}건 → documents 저장 시작`);
  const urlToId = await upsertDocuments(docs);

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

  console.log(`[Airbridge] 청크 생성: ${chunkRows.length}건 → chunks 저장 시작`);
  await upsertChunks(chunkRows);
  console.log('[Airbridge] 완료');
}

if (require.main === module) {
  crawlAndSaveAirbridge().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
