import type { EvaluationMetrics, HumanJudgment, QAResult } from '../../shared/types.js';

export function computeMetrics(results: QAResult[]): EvaluationMetrics {
  if (results.length === 0) {
    return { accuracy: 0, partialRate: 0, wrongRate: 0, avgConfidence: 0, total: 0 };
  }
  let correct = 0;
  let partial = 0;
  let wrong = 0;
  let confidenceSum = 0;
  for (const r of results) {
    confidenceSum += r.confidence;
    switch (r.humanJudgment) {
      case 'correct':
        correct++;
        break;
      case 'partial':
        partial++;
        break;
      case 'wrong':
        wrong++;
        break;
      default: {
        const auto = autoJudge(r.answer, r.standardAnswer);
        if (auto === 'correct') correct++;
        else if (auto === 'partial') partial++;
        else wrong++;
      }
    }
  }
  const total = results.length;
  return {
    accuracy: correct / total,
    partialRate: partial / total,
    wrongRate: wrong / total,
    avgConfidence: confidenceSum / total,
    total,
  };
}

export function autoJudge(answer: string, standardAnswer?: string): HumanJudgment {
  if (!standardAnswer) return 'wrong';
  const a = answer.toLowerCase().replace(/\s+/g, '');
  const s = standardAnswer.toLowerCase().replace(/\s+/g, '');
  if (!a) return 'wrong';
  if (a.includes(s) || s.includes(a)) return 'correct';
  const overlap = commonChars(a, s);
  const ratio = overlap / Math.max(a.length, s.length);
  if (ratio >= 0.5) return 'partial';
  return 'wrong';
}

function commonChars(a: string, b: string): number {
  const freq: Record<string, number> = {};
  for (const ch of a) freq[ch] = (freq[ch] ?? 0) + 1;
  let count = 0;
  for (const ch of b) {
    if (freq[ch] && freq[ch] > 0) {
      count++;
      freq[ch]--;
    }
  }
  return count;
}
