import type { Chunk } from '../../shared/types.js';

export interface SplitOptions {
  chunkSize: number;
  chunkOverlap: number;
}

function countTokens(text: string): number {
  let count = 0;
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      if (/\s/.test(text[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j < text.length && /[A-Za-z0-9]/.test(text[j])) j++;
      if (j > i) {
        count++;
        i = j;
      } else {
        i++;
      }
    } else {
      count++;
      i++;
    }
  }
  return Math.max(1, count);
}

function splitBySentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';
  const sentenceEnd = /[。！？.!?\n；;]/;
  for (let i = 0; i < text.length; i++) {
    current += text[i];
    if (sentenceEnd.test(text[i])) {
      const trimmed = current.trim();
      if (trimmed) sentences.push(trimmed);
      current = '';
    }
  }
  const trimmed = current.trim();
  if (trimmed) sentences.push(trimmed);
  return sentences;
}

export function splitDocument(
  documentId: string,
  content: string,
  options: SplitOptions,
): Omit<Chunk, 'id'>[] {
  const { chunkSize, chunkOverlap } = options;
  if (!content.trim()) return [];
  const sentences = splitBySentences(content);
  const chunks: Omit<Chunk, 'id'>[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;
  let globalStart = 0;
  const sentenceStarts: number[] = [];
  let pos = 0;
  for (const s of sentences) {
    sentenceStarts.push(pos);
    pos += s.length;
  }
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const t = countTokens(s);
    if (currentTokens + t > chunkSize && currentSentences.length > 0) {
      const chunkText = currentSentences.join(' ');
      chunks.push({
        documentId,
        content: chunkText,
        startIndex: sentenceStarts[i - currentSentences.length],
        endIndex: sentenceStarts[i] + sentences[i - 1].length,
        tokens: currentTokens,
      });
      const overlap = Math.min(chunkOverlap, currentSentences.length - 1);
      const keepSentences = overlap > 0 ? currentSentences.slice(-overlap) : [];
      const keepTokens = keepSentences.reduce((acc, s2) => acc + countTokens(s2), 0);
      currentSentences = keepSentences;
      currentTokens = keepTokens;
    }
    currentSentences.push(s);
    currentTokens += t;
    globalStart += s.length;
  }
  if (currentSentences.length > 0) {
    const chunkText = currentSentences.join(' ');
    chunks.push({
      documentId,
      content: chunkText,
      startIndex: sentenceStarts[sentences.length - currentSentences.length] ?? 0,
      endIndex: content.length,
      tokens: currentTokens,
    });
  }
  if (chunks.length === 0 && content.trim()) {
    chunks.push({
      documentId,
      content,
      startIndex: 0,
      endIndex: content.length,
      tokens: countTokens(content),
    });
  }
  return chunks;
}

export { countTokens };
