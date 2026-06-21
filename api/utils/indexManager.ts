import path from 'node:path';
import { PATHS, readJsonFile, writeJsonFile, computeChecksum, fileExists } from '../data/storage.js';
import type { Chunk, RetrievalParams, RetrievedChunk } from '../../shared/types.js';
import { countTokens } from './chunkSplitter.js';

interface InvertedIndex {
  versionId: string;
  tokenMap: Record<string, Array<{ chunkId: string; freq: number }>>;
  docFreq: Record<string, number>;
  chunkLengths: Record<string, number>;
  avgChunkLength: number;
  totalChunks: number;
  checksum: string;
  builtAt: number;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  let word = '';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const code = lower.charCodeAt(i);
    if (/[a-z0-9]/.test(ch)) {
      word += ch;
    } else {
      if (word) {
        tokens.push(word);
        word = '';
      }
      if (code >= 0x4e00 && code <= 0x9fff) {
        tokens.push(ch);
      }
    }
  }
  if (word) tokens.push(word);
  return tokens;
}

function bm25Score(
  tf: number,
  df: number,
  N: number,
  dl: number,
  avgdl: number,
  k1 = 1.5,
  b = 0.75,
): number {
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * dl) / avgdl));
  return idf * tfNorm;
}

function tfidfScore(
  tf: number,
  df: number,
  N: number,
): number {
  const idf = Math.log(1 + N / (1 + df));
  return (1 + Math.log(tf)) * idf;
}

export function buildIndex(versionId: string, chunks: Chunk[]): InvertedIndex {
  const tokenMap: Record<string, Array<{ chunkId: string; freq: number }>> = {};
  const docFreq: Record<string, number> = {};
  const chunkLengths: Record<string, number> = {};
  let totalLen = 0;
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.content);
    chunkLengths[chunk.id] = tokens.length;
    totalLen += tokens.length;
    const freq: Record<string, number> = {};
    for (const t of tokens) {
      freq[t] = (freq[t] ?? 0) + 1;
    }
    for (const [token, count] of Object.entries(freq)) {
      if (!tokenMap[token]) tokenMap[token] = [];
      tokenMap[token].push({ chunkId: chunk.id, freq: count });
      docFreq[token] = (docFreq[token] ?? 0) + 1;
    }
  }
  const totalChunks = chunks.length;
  const avgChunkLength = totalChunks > 0 ? totalLen / totalChunks : 0;
  const idx: InvertedIndex = {
    versionId,
    tokenMap,
    docFreq,
    chunkLengths,
    avgChunkLength,
    totalChunks,
    checksum: '',
    builtAt: Date.now(),
  };
  idx.checksum = computeChecksum({
    tokenMap,
    docFreq,
    chunkLengths,
    avgChunkLength,
    totalChunks,
  });
  return idx;
}

export function saveIndex(versionId: string, index: InvertedIndex): void {
  const filePath = path.join(PATHS.indexes, `${versionId}.json`);
  writeJsonFile(filePath, index);
}

export function loadIndex(versionId: string): InvertedIndex | null {
  const filePath = path.join(PATHS.indexes, `${versionId}.json`);
  if (!fileExists(filePath)) return null;
  try {
    return readJsonFile<InvertedIndex>(filePath, null as unknown as InvertedIndex);
  } catch {
    return null;
  }
}

export function validateIndex(versionId: string, index: InvertedIndex | null): boolean {
  if (!index) return false;
  if (index.versionId !== versionId) return false;
  const expected = computeChecksum({
    tokenMap: index.tokenMap,
    docFreq: index.docFreq,
    chunkLengths: index.chunkLengths,
    avgChunkLength: index.avgChunkLength,
    totalChunks: index.totalChunks,
  });
  return expected === index.checksum;
}

export function searchIndex(
  index: InvertedIndex,
  question: string,
  chunks: Array<Chunk & { documentTitle: string }>,
  params: RetrievalParams,
): RetrievedChunk[] {
  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) return [];
  const chunkScores: Record<string, number> = {};
  const N = index.totalChunks;
  const avgdl = index.avgChunkLength || 1;
  for (const token of queryTokens) {
    const postings = index.tokenMap[token];
    if (!postings) continue;
    const df = index.docFreq[token] ?? 0;
    for (const { chunkId, freq } of postings) {
      const dl = index.chunkLengths[chunkId] ?? avgdl;
      const score = params.useBM25
        ? bm25Score(freq, df, N, dl, avgdl)
        : tfidfScore(freq, df, N);
      chunkScores[chunkId] = (chunkScores[chunkId] ?? 0) + score;
    }
  }
  const maxScore = Math.max(1, ...Object.values(chunkScores));
  const results = Object.entries(chunkScores)
    .map(([chunkId, score]) => ({ chunkId, score: score / maxScore }))
    .filter((r) => r.score >= params.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.topK);
  const chunkMap = new Map(chunks.map((c) => [c.id, c]));
  return results
    .map((r) => {
      const c = chunkMap.get(r.chunkId);
      if (!c) return null;
      return {
        chunkId: r.chunkId,
        content: c.content,
        score: r.score,
        documentTitle: c.documentTitle,
      };
    })
    .filter((v): v is RetrievedChunk => v !== null);
}

export function deleteIndex(versionId: string): boolean {
  const filePath = path.join(PATHS.indexes, `${versionId}.json`);
  try {
    if (fileExists(filePath)) {
      writeJsonFile(filePath, {});
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function generateAnswer(
  question: string,
  retrieved: RetrievedChunk[],
  standardAnswer?: string,
): { answer: string; confidence: number } {
  if (retrieved.length === 0) {
    return {
      answer: '未找到相关知识片段，请补充知识库后重试。',
      confidence: 0,
    };
  }
  if (standardAnswer && standardAnswer.trim()) {
    return { answer: standardAnswer, confidence: 1 };
  }
  const topChunk = retrieved[0];
  const combinedScores = retrieved.reduce((acc, r) => acc + r.score, 0);
  const avgScore = combinedScores / retrieved.length;
  const evidence = retrieved
    .map((r, i) => `【参考${i + 1}，来源：${r.documentTitle}】${r.content}`)
    .join('\n\n');
  const answer = `根据知识库检索结果，关于"${question}"的回答如下：\n\n${topChunk.content}\n\n---\n参考片段：\n${evidence}`;
  return { answer, confidence: Math.min(1, avgScore) };
}
