import { chromium } from 'playwright';
import { MmpDocument, RawArticle } from '../types';
import { extractText, isValidContent } from '../utils/html-parser';
import { upsertDocuments, upsertChunks, ChunkRow } from '../lib/supabase';
import { chunkText } from '../utils/chunker';

const BASE_URL = 'https://help.adjust.com/ko';
const RATE_LIMIT_MS = 500;
const CONTENT_SELECTORS = ['article', '.article-content', '.article-body', 'main', '.content', '#main-content'];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  // /ko/ 경로를 포함하고 루트 페이지가 아니면 수집 대상으로 간주
  const u = new URL(url);
  return u.pathname.startsWith('/ko/') && u.pathname !== '/ko' && u.pathname !== '/ko/';
}

export async function crawlAdjust(): Promise<RawArticle[]> {
  console.log('[Adjust] 크롤링 시작...');

  const browser = await chromium.launch({ headless: true });
  const visited = new Set<string>();
  const queue: string[] = [
    BASE_URL,
    'https://help.adjust.com/ko/article/getting-started-with-adjust',
    'https://help.adjust.com/ko/marketer',
    'https://help.adjust.com/ko/suite',
    'https://help.adjust.com/ko/operator',
    'https://help.adjust.com/ko/mobile-app'
  ];
  const articles: RawArticle[] = [];

  try {
    while (queue.length > 0) {
      const rawUrl = queue.shift()!;
      const url = normalizeUrl(rawUrl);

      if (visited.has(url)) continue;
      visited.add(url);

      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 동적 렌더링 대기
        await page.waitForSelector('article, .article-content, .article-body, main', { timeout: 10000 }).catch(() => { });

        let content = '';
        const selectors = ['article', '.article-content', '.article-body', 'div[class*="ArticleBody"]', 'main'];
        for (const selector of selectors) {
          content = await page.$eval(selector, el => (el as HTMLElement).innerHTML).catch(() => '');
          if (content) break;
        }

        if (content && isContentPage(url)) {
          const title = await page.title();
          const docTitle = title.replace(/\s*[-|]\s*Adjust.*$/i, '').trim();
          const plainContent = extractText(content);

          if (isValidContent(plainContent)) {
            // 점진적 저장: 발견 즉시 DB 반영
            const doc: MmpDocument = {
              title: docTitle,
              content: plainContent,
              url,
              mmp_name: 'Adjust',
              crawled_at: new Date().toISOString(),
            };

            const urlToId = await upsertDocuments([doc]);
            const docId = urlToId.get(url);

            if (docId) {
              const chunkRows: ChunkRow[] = chunkText(plainContent).map(c => ({
                document_id: docId,
                chunk_index: c.chunk_index,
                content: c.content,
                url,
                title: docTitle,
                mmp_name: 'Adjust',
              }));
              await upsertChunks(chunkRows);
              articles.push({ title: docTitle, body: content, url, mmp_name: 'Adjust' });
              console.log(`[Adjust] ✅ 수집 및 저장 완료: ${url} (누적 ${articles.length}건)`);
            }
          }
        }

        // 동일 도메인 한국어 링크 수집
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
          'https://help.adjust.com'
        );

        console.log(`[Adjust] ${url} 방문 완료 (발견된 링크: ${links.length}개)`);
        for (const link of links) {
          const norm = normalizeUrl(link);
          if (
            !visited.has(norm) &&
            norm.startsWith('https://help.adjust.com/ko') &&
            !norm.includes('#')
          ) {
            queue.push(norm);
          }
        }
      } catch (err) {
        console.warn(`[Adjust] 페이지 오류 (${url}):`, (err as Error).message);
      } finally {
        await page.close();
      }

      await sleep(RATE_LIMIT_MS);
    }
  } finally {
    await browser.close();
  }

  console.log(`[Adjust] 수집 완료: ${articles.length}건`);
  return articles;
}

export async function crawlAndSaveAdjust(): Promise<void> {
  await crawlAdjust();
  console.log('[Adjust] 전체 작업 완료');
}

if (require.main === module) {
  crawlAndSaveAdjust().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
