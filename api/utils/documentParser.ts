import type { KnowledgeSource, TestCase } from '../../shared/types.js';

export interface ParsedDocument {
  title: string;
  content: string;
  source: KnowledgeSource;
}

export function parseMarkdown(filename: string, content: string): ParsedDocument {
  const lines = content.trim().split('\n');
  let title = filename.replace(/\.md$/i, '');
  let bodyStart = 0;
  if (lines.length > 0 && lines[0].startsWith('# ')) {
    title = lines[0].replace(/^#\s+/, '').trim();
    bodyStart = 1;
  }
  const body = lines.slice(bodyStart).join('\n').trim();
  return { title, content: body, source: 'markdown' };
}

export function parseFAQ(filename: string, content: string): ParsedDocument[] {
  const lines = content.split('\n');
  if (lines.length < 2) {
    return [{ title: filename.replace(/\.csv$/i, ''), content, source: 'faq' }];
  }
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(sep).map((s) => s.trim().toLowerCase());
  const qIdx = header.findIndex((h) => h.includes('question') || h.includes('问题') || h === 'q');
  const aIdx = header.findIndex((h) => h.includes('answer') || h.includes('回答') || h.includes('答案') || h === 'a');
  if (qIdx === -1 || aIdx === -1) {
    return [{ title: filename.replace(/\.csv$/i, ''), content, source: 'faq' }];
  }
  const docs: ParsedDocument[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep);
    if (cols.length <= Math.max(qIdx, aIdx)) continue;
    const q = cols[qIdx]?.trim() ?? '';
    const a = cols[aIdx]?.trim() ?? '';
    if (!q && !a) continue;
    docs.push({
      title: `FAQ: ${q.slice(0, 50)}${q.length > 50 ? '...' : ''}`,
      content: `问：${q}\n\n答：${a}`,
      source: 'faq',
    });
  }
  return docs;
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.replace(/^"|"$/g, ''));
}

export function parseHistory(
  filename: string,
  content: string,
): ParsedDocument[] {
  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.questions ?? [];
    if (!Array.isArray(items)) {
      return [{ title: filename.replace(/\.json$/i, ''), content, source: 'history' }];
    }
    const docs: ParsedDocument[] = [];
    for (const item of items) {
      const q =
        item.question ?? item.q ?? item.Query ?? item.query ?? '';
      const a =
        item.answer ?? item.a ?? item.Answer ?? item.response ?? '';
      if (!q && !a) continue;
      docs.push({
        title: `历史问答: ${String(q).slice(0, 50)}${String(q).length > 50 ? '...' : ''}`,
        content: `用户问题：${q}\n\n标准回答：${a}`,
        source: 'history',
      });
    }
    return docs.length > 0 ? docs : [{ title: filename.replace(/\.json$/i, ''), content, source: 'history' }];
  } catch {
    return [{ title: filename.replace(/\.json$/i, ''), content, source: 'history' }];
  }
}

export function parseTestCases(content: string): TestCase[] {
  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.testSet ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({
        question: String(item.question ?? item.q ?? ''),
        standardAnswer: String(item.standardAnswer ?? item.answer ?? item.a ?? ''),
      }))
      .filter((t) => t.question.trim() && t.standardAnswer.trim());
  } catch {
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const header = lines[0].split(sep).map((s) => s.trim().toLowerCase());
    const qIdx = header.findIndex((h) => h.includes('question') || h.includes('问题'));
    const aIdx = header.findIndex((h) => h.includes('answer') || h.includes('回答'));
    if (qIdx === -1 || aIdx === -1) return [];
    const cases: TestCase[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i], sep);
      if (cols.length <= Math.max(qIdx, aIdx)) continue;
      const q = cols[qIdx]?.trim() ?? '';
      const a = cols[aIdx]?.trim() ?? '';
      if (q && a) cases.push({ question: q, standardAnswer: a });
    }
    return cases;
  }
}
