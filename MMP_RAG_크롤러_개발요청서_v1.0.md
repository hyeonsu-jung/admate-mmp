# MMP RAG 크롤러 개발 요청서 v1.0

> **작성일**: 2026-04-17
> **대상 개발자**: MMP RAG 시스템 담당자
> **목적**: AppsFlyer / Airbridge / Adjust 헬프센터 문서 수집 크롤러 개발 착수 가이드

---

## 1. 개요

MMP(Mobile Measurement Partner) RAG 시스템의 지식 베이스 구축을 위해 3개 MMP 헬프센터의 문서를 수집하는 크롤러를 개발합니다.

AppsFlyer는 **Zendesk Help Center API**를 통해 인증 없이 아티클 전체(본문 포함)를 수집할 수 있음이 확인되었습니다. Airbridge와 Adjust는 별도의 자체 플랫폼으로 크롤링 전략이 다릅니다.

---

## 2. MMP별 플랫폼 분석 및 크롤링 전략

### 2.1 AppsFlyer — Zendesk API (✅ 검증 완료)

**플랫폼**: Zendesk Help Center
**베이스 URL**: `https://support.appsflyer.com/hc/ko`
**크롤링 방법**: Zendesk Help Center REST API (인증 불필요)

**확인된 데이터 규모** (2026-04-17 기준)

| 리소스 | 수량 | 페이지 수 |
|--------|------|-----------|
| 카테고리 | 2개 | 1페이지 |
| 섹션 | 88개 | 3페이지 |
| 아티클 | **368개** | **13페이지** |

**API 엔드포인트**

```
# 아티클 전체 목록 (본문 포함, 30개씩 페이지네이션)
GET https://support.appsflyer.com/api/v2/help_center/ko/articles.json?page={N}&per_page=30

# 섹션 목록
GET https://support.appsflyer.com/api/v2/help_center/ko/sections.json?page={N}&per_page=30

# 카테고리 목록
GET https://support.appsflyer.com/api/v2/help_center/ko/categories.json
```

**응답 데이터 구조 (아티클)**

```json
{
  "articles": [
    {
      "id": 44622680478737,
      "html_url": "https://support.appsflyer.com/hc/ko/articles/44622680478737",
      "title": "새소식 - SDK가 이제 IPv6 주소 검색을 지원합니다.",
      "body": "<HTML 본문 전체>",
      "section_id": 6551161473041,
      "locale": "ko",
      "updated_at": "2026-04-08T06:10:07Z",
      "outdated": false
    }
  ],
  "page": 1,
  "next_page": "https://support.appsflyer.com/api/v2/help_center/ko/articles.json?page=2&per_page=30",
  "page_count": 13,
  "count": 368
}
```

**수집 로직 (TypeScript 의사코드)**

```typescript
async function crawlAppsFlyer(): Promise<Article[]> {
  const articles: Article[] = [];
  let page = 1;
  const totalPages = 13; // 최초 1회 조회 후 page_count로 동적 결정

  while (page <= totalPages) {
    const res = await fetch(
      `https://support.appsflyer.com/api/v2/help_center/ko/articles.json?page=${page}&per_page=30`
    );
    const data = await res.json();

    for (const article of data.articles) {
      if (article.outdated) continue; // 오래된 문서 제외
      articles.push({
        title: article.title,
        body: article.body,          // HTML 본문 (파싱 필요)
        url: article.html_url,
        section_id: article.section_id,
        updated_at: article.updated_at,
        mmp_name: 'AppsFlyer',
      });
    }

    if (!data.next_page) break;
    page++;
    await sleep(300); // Rate limit 준수
  }

  return articles;
}
```

> ✅ **Playwright 불필요** — 단순 HTTP GET으로 본문까지 수집 완료

---

### 2.2 Airbridge — BFS 크롤링

**플랫폼**: 자체 헬프센터 (Zendesk 아님)
**베이스 URL**: `https://help.airbridge.io/ko` (한국어)
**크롤링 방법**: Playwright 기반 BFS(너비 우선 탐색) 크롤링

**URL 패턴 (확인됨)**

```
가이드:     https://help.airbridge.io/en/guides/{slug}
개발자:     https://help.airbridge.io/en/developers/{slug}
레퍼런스:   https://help.airbridge.io/en/references/{slug}
```

**수집 로직**

```typescript
async function crawlAirbridge(): Promise<Article[]> {
  const browser = await chromium.launch();
  const visited = new Set<string>();
  const queue = ['https://help.airbridge.io/en'];
  const articles: Article[] = [];

  while (queue.length > 0) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // 본문 추출 (main, article 등 콘텐츠 영역)
    const content = await page.$eval('main, article, .article-body', el => el.innerHTML)
      .catch(() => '');

    if (content) {
      articles.push({
        title: await page.title(),
        body: content,
        url,
        mmp_name: 'Airbridge',
      });
    }

    // 동일 도메인 링크 수집
    const links = await page.$$eval('a[href]', (els, base) =>
      els.map(el => new URL(el.getAttribute('href')!, base).href)
         .filter(href => href.startsWith(base)),
      'https://help.airbridge.io/en'
    );

    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }

    await page.close();
    await sleep(500);
  }

  await browser.close();
  return articles;
}
```

> ⚠️ **사전 확인 필요**: 한국어 페이지(`/ko`) 존재 여부 및 본문 CSS 선택자 실제 검증 요망

---

### 2.3 Adjust — BFS 크롤링

**플랫폼**: 자체 헬프센터 (Zendesk 아님)
**베이스 URL**: `https://help.adjust.com/ko`
**크롤링 방법**: Playwright 기반 BFS 크롤링

**URL 패턴 (확인됨)**

```
아티클:  https://help.adjust.com/ko/article/{slug}
섹션:    https://help.adjust.com/ko/suite/{slug}
```

**수집 로직**

```typescript
async function crawlAdjust(): Promise<Article[]> {
  // Airbridge와 동일한 BFS 패턴 적용
  // 베이스 URL: https://help.adjust.com/ko
  // 확인된 본문 영역 선택자: 실제 페이지에서 검증 필요
}
```

> ⚠️ **사전 확인 필요**: 실제 본문 CSS 선택자, JS 렌더링 필요 여부, Rate limit 정책 확인 요망

---

## 3. 공통 처리 파이프라인

### 3.1 HTML → 텍스트 파싱

수집된 `body` (HTML)에서 아래 요소를 제거하고 순수 텍스트를 추출합니다.

```typescript
import { parse } from 'node-html-parser';

function extractText(html: string): string {
  const root = parse(html);

  // 불필요 요소 제거
  root.querySelectorAll('nav, header, footer, .breadcrumb, .toc, script, style').forEach(el => el.remove());

  // 코드 블록 보존 (SDK 스니펫 유실 방지)
  // pre > code 내용은 그대로 유지

  return root.text.replace(/\s+/g, ' ').trim();
}
```

### 3.2 품질 필터링

| 조건 | 처리 |
|------|------|
| 본문 길이 < 100자 | 수집 제외 |
| `outdated: true` (AppsFlyer만 해당) | 수집 제외 |
| 제목이 없거나 공통 UI 텍스트 | 플래그 처리 후 검토 |
| 중복 URL | 재수집 Skip |

### 3.3 메타데이터 구조

Supabase `documents` 테이블에 아래 필드로 적재합니다.

```typescript
interface MmpDocument {
  title: string;
  content: string;          // 파싱된 텍스트
  url: string;              // 원문 URL (출처 표기용)
  mmp_name: 'AppsFlyer' | 'Airbridge' | 'Adjust';
  section_id?: number;      // AppsFlyer만 해당
  updated_at?: string;      // AppsFlyer만 해당
  crawled_at: string;       // 수집 시각
}
```

> ⚠️ `mmp_name` 컬럼이 기존 `documents` 테이블에 없는 경우 **마이그레이션 필요**

---

## 4. Supabase DB 마이그레이션

기존 `documents` 테이블에 아래 컬럼을 추가합니다.

```sql
-- mmp_name 컬럼 추가
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS mmp_name TEXT CHECK (mmp_name IN ('AppsFlyer', 'Airbridge', 'Adjust'));

-- 인덱스 추가 (mmp_name 기반 필터링 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_documents_mmp_name ON documents(mmp_name);
```

---

## 5. Vercel 서버리스 제약 대응

크롤링 및 임베딩 배치 작업은 Vercel의 5분 실행 제한을 초과합니다. 아래 방식으로 분리합니다.

| 작업 | 실행 환경 | 비고 |
|------|-----------|------|
| AppsFlyer API 수집 (368건) | GitHub Actions 또는 로컬 스크립트 | 예상 소요: ~3분 |
| Airbridge BFS 크롤링 | GitHub Actions (Playwright 지원) | 예상 소요: 5~15분 |
| Adjust BFS 크롤링 | GitHub Actions (Playwright 지원) | 예상 소요: 5~15분 |
| 임베딩 생성 및 Supabase 적재 | GitHub Actions 배치 | 페이지 단위 분할 처리 |

---

## 6. 개발 실행 순서

```
Step 1 — AppsFlyer Zendesk API 크롤러 구현 및 검증
         → 인증 없이 GET 요청만으로 368건 본문 수집
         → 수집 데이터 샘플 확인 후 파싱 품질 검토

Step 2 — Airbridge 헬프센터 CSS 선택자 조사
         → /ko 페이지에서 본문 영역 확인
         → BFS 크롤러 구현 및 URL 목록 사전 추출

Step 3 — Adjust 헬프센터 CSS 선택자 조사
         → /ko 페이지에서 본문 영역 확인
         → BFS 크롤러 구현 및 URL 목록 사전 추출

Step 4 — HTML → 텍스트 파싱 공통 모듈 구현
         → 코드 블록 보존 로직 포함
         → 품질 필터 적용

Step 5 — Supabase documents 테이블 마이그레이션
         → mmp_name 컬럼 추가 및 인덱스 생성

Step 6 — 수집 데이터 임베딩 생성 및 Supabase 적재
         → 기존 AdMate 임베딩 파이프라인 재사용

Step 7 — 수집 완료 후 품질 검증
         → 샘플 질문 기반 RAG 검색 테스트
         → 코드 스니펫이 청크에서 잘리지 않는지 확인
```

---

## 7. 참고 사항

### 기존 AdMate에서 재사용 가능한 컴포넌트

- Supabase Vector DB 연결 및 임베딩 파이프라인
- HTML 파싱 및 청킹 로직 (`UnifiedChunkingService`)
- GitHub Actions 배치 워크플로우 설정

### MMP별 수집 대상 언어

| MMP | 수집 언어 | 비고 |
|-----|-----------|------|
| AppsFlyer | 한국어 (`/hc/ko`) | API 검증 완료 |
| Airbridge | 한국어 (`/ko`) | URL 구조 확인됨 |
| Adjust | 한국어 (`/ko`) | URL 구조 확인됨 |
