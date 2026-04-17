import { parse } from 'node-html-parser';

const MIN_CONTENT_LENGTH = 100;

export function extractText(html: string): string {
  const root = parse(html);

  root.querySelectorAll('nav, header, footer, .breadcrumb, .toc, script, style, [role="navigation"]').forEach(el => el.remove());

  // 코드 블록 내용을 플레인 텍스트로 보존
  root.querySelectorAll('pre code, pre').forEach(el => {
    const code = el.text.trim();
    if (code) {
      el.replaceWith(`\n\`\`\`\n${code}\n\`\`\`\n`);
    }
  });

  return root.text.replace(/\s+/g, ' ').trim();
}

export function isValidContent(text: string): boolean {
  return text.length >= MIN_CONTENT_LENGTH;
}
