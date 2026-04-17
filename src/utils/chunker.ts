export interface Chunk {
  content: string;
  chunk_index: number;
}

const CHUNK_SIZE = 800;   // 문자 기준 (~400 토큰, 한국어 고려)
const OVERLAP = 150;      // 청크 간 겹침 문자 수

// 코드 블록 분리: ```...``` 를 통째로 하나의 세그먼트로 취급
function splitPreservingCodeBlocks(text: string): string[] {
  const segments: string[] = [];
  const codeBlockRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    segments.push(match[0]); // 코드 블록 전체를 하나의 세그먼트로
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.filter(s => s.trim().length > 0);
}

// 일반 텍스트를 단락/문장 경계에서 분할
function splitTextSegment(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const results: string[] = [];

  // 1순위: 빈 줄 기준
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > maxSize && current.length > 0) {
      results.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) results.push(current.trim());

  // 여전히 maxSize 초과하는 단락은 문자 단위로 자름
  const final: string[] = [];
  for (const r of results) {
    if (r.length <= maxSize) {
      final.push(r);
    } else {
      for (let i = 0; i < r.length; i += maxSize - OVERLAP) {
        final.push(r.slice(i, i + maxSize));
        if (i + maxSize >= r.length) break;
      }
    }
  }

  return final.filter(s => s.trim().length > 0);
}

export function chunkText(content: string): Chunk[] {
  const segments = splitPreservingCodeBlocks(content);
  const rawChunks: string[] = [];

  for (const seg of segments) {
    if (seg.startsWith('```')) {
      // 코드 블록은 maxSize 초과해도 분할하지 않음
      rawChunks.push(seg);
    } else {
      rawChunks.push(...splitTextSegment(seg, CHUNK_SIZE));
    }
  }

  // 작은 조각은 앞 청크에 합침
  const merged: string[] = [];
  for (const chunk of rawChunks) {
    if (merged.length > 0 && (merged[merged.length - 1] + chunk).length <= CHUNK_SIZE) {
      merged[merged.length - 1] += '\n\n' + chunk;
    } else {
      merged.push(chunk);
    }
  }

  return merged
    .filter(c => c.trim().length >= 50)
    .map((content, chunk_index) => ({ content: content.trim(), chunk_index }));
}
