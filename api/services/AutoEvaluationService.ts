import type {
  AutoEvaluation,
  DimensionScore,
  EvaluationWeights,
  HumanJudgment,
  QAResult,
  EvaluationMetrics,
} from '../../shared/types.js';

const DEFAULT_WEIGHTS: EvaluationWeights = {
  semanticSimilarity: 0.35,
  keyInfoCoverage: 0.3,
  factualAccuracy: 0.25,
  formatNormativity: 0.1,
  correctThreshold: 0.75,
  partialThreshold: 0.4,
};

let currentWeights: EvaluationWeights = { ...DEFAULT_WEIGHTS };

export function getWeights(): EvaluationWeights {
  return { ...currentWeights };
}

export function setWeights(weights: Partial<EvaluationWeights>): EvaluationWeights {
  const semanticSimilarity = weights.semanticSimilarity ?? currentWeights.semanticSimilarity;
  const keyInfoCoverage = weights.keyInfoCoverage ?? currentWeights.keyInfoCoverage;
  const factualAccuracy = weights.factualAccuracy ?? currentWeights.factualAccuracy;
  const formatNormativity = weights.formatNormativity ?? currentWeights.formatNormativity;

  const total = semanticSimilarity + keyInfoCoverage + factualAccuracy + formatNormativity;
  if (total <= 0) {
    throw new Error('维度权重之和必须大于0');
  }

  currentWeights = {
    semanticSimilarity,
    keyInfoCoverage,
    factualAccuracy,
    formatNormativity,
    correctThreshold: weights.correctThreshold ?? currentWeights.correctThreshold,
    partialThreshold: weights.partialThreshold ?? currentWeights.partialThreshold,
  };

  return { ...currentWeights };
}

export function resetWeights(): EvaluationWeights {
  currentWeights = { ...DEFAULT_WEIGHTS };
  return { ...currentWeights };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalize(text);
  const words: string[] = [];

  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (/[\u4e00-\u9fa5]/.test(ch)) {
      words.push(ch);
      i++;
    } else if (ch !== ' ') {
      let j = i;
      while (j < normalized.length && normalized[j] !== ' ' && !/[\u4e00-\u9fa5]/.test(normalized[j])) {
        j++;
      }
      words.push(normalized.slice(i, j));
      i = j;
    } else {
      i++;
    }
  }

  return words;
}

function extractNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(''));
  }
  return ngrams;
}

function extractKeywords(text: string): string[] {
  const normalized = normalize(text);
  const tokens = tokenize(normalized);

  const unigrams = tokens.filter((t) => t.length > 0);
  const bigrams = extractNgrams(tokens, 2);
  const trigrams = extractNgrams(tokens, 3);

  const wordFreq: Record<string, number> = {};
  [...unigrams, ...bigrams, ...trigrams].forEach((w) => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });

  const stopwords = new Set([
    '的', '是', '在', '了', '和', '与', '及', '或', '等', '也', '都', '就', '要', '会', '可以',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  ]);

  const keywords = Object.entries(wordFreq)
    .filter(([word]) => {
      if (word.length < 2) return false;
      if (stopwords.has(word.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  return keywords;
}

function calculateSemanticSimilarity(answer: string, standardAnswer: string): number {
  const ansTokens = tokenize(answer);
  const stdTokens = tokenize(standardAnswer);

  if (ansTokens.length === 0 || stdTokens.length === 0) return 0;

  const ansSet = new Set(ansTokens);
  const stdSet = new Set(stdTokens);

  const intersection = new Set([...ansSet].filter((x) => stdSet.has(x)));
  const union = new Set([...ansSet, ...stdSet]);

  const jaccard = intersection.size / union.size;

  const ansBigrams = new Set(extractNgrams(ansTokens, 2));
  const stdBigrams = new Set(extractNgrams(stdTokens, 2));
  const bigramIntersection = new Set([...ansBigrams].filter((x) => stdBigrams.has(x)));
  const bigramUnion = new Set([...ansBigrams, ...stdBigrams]);
  const bigramJaccard = bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;

  const ansTrigrams = new Set(extractNgrams(ansTokens, 3));
  const stdTrigrams = new Set(extractNgrams(stdTokens, 3));
  const trigramIntersection = new Set([...ansTrigrams].filter((x) => stdTrigrams.has(x)));
  const trigramUnion = new Set([...ansTrigrams, ...stdTrigrams]);
  const trigramJaccard = trigramUnion.size > 0 ? trigramIntersection.size / trigramUnion.size : 0;

  const levenshtein = calculateLevenshtein(normalize(answer), normalize(standardAnswer));
  const maxLen = Math.max(answer.length, standardAnswer.length);
  const editSimilarity = maxLen > 0 ? 1 - levenshtein / maxLen : 0;

  const similarity = jaccard * 0.3 + bigramJaccard * 0.3 + trigramJaccard * 0.2 + editSimilarity * 0.2;

  return Math.max(0, Math.min(1, similarity));
}

function calculateLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

function calculateKeyInfoCoverage(
  answer: string,
  standardAnswer: string,
): { score: number; matched: string[]; missing: string[] } {
  const keywords = extractKeywords(standardAnswer);
  const ansNormalized = normalize(answer);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    if (ansNormalized.includes(keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = keywords.length > 0 ? matched.length / keywords.length : 0;

  return { score, matched, missing };
}

function calculateFactualAccuracy(
  answer: string,
  standardAnswer: string,
): { score: number; errors: string[] } {
  const errors: string[] = [];
  const ansNormalized = normalize(answer);
  const stdNormalized = normalize(standardAnswer);

  const stdNumbers = (stdNormalized.match(/\d+(\.\d+)?/g) as string[]) || [];
  const ansNumbers = (ansNormalized.match(/\d+(\.\d+)?/g) as string[]) || [];

  for (const num of stdNumbers) {
    if (!ansNumbers.includes(num)) {
      errors.push(`缺少关键数字: ${num}`);
    }
  }

  const contradictionPatterns = [
    { pattern: /(不支持|无法|不能|没有|不是)/, negate: true },
    { pattern: /(支持|可以|能|有|是)/, negate: false },
  ];

  for (const { pattern, negate } of contradictionPatterns) {
    const stdMatches = stdNormalized.match(pattern);
    const ansMatches = ansNormalized.match(pattern);

    if (stdMatches && !ansMatches && !negate) {
      errors.push(`可能缺少肯定表述: ${pattern.source}`);
    }
    if (!stdMatches && ansMatches && negate) {
      errors.push(`可能存在多余的否定表述`);
    }
  }

  const factScore = errors.length === 0 ? 1 : Math.max(0, 1 - errors.length * 0.2);

  return { score: factScore, errors };
}

function calculateFormatNormativity(answer: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1;

  if (answer.trim().length === 0) {
    issues.push('答案为空');
    return { score: 0, issues };
  }

  if (answer.length < 10) {
    issues.push('答案过短，可能不够详细');
    score -= 0.2;
  }

  const hasPunctuation = /[。！？.!?]/.test(answer);
  if (!hasPunctuation) {
    issues.push('缺少标点符号');
    score -= 0.1;
  }

  const hasProperEnding = /[。！？.!?]\s*$/.test(answer.trim());
  if (!hasProperEnding) {
    issues.push('答案结尾不完整');
    score -= 0.1;
  }

  const lines = answer.split('\n').filter((l) => l.trim());
  const listPattern = /^(\d+[.、)）]|[•●\-—*])/;
  let hasListFormat = false;
  for (const line of lines) {
    if (listPattern.test(line.trim())) {
      hasListFormat = true;
      break;
    }
  }

  if (lines.length >= 3 && !hasListFormat && answer.length > 100) {
    issues.push('建议使用列表格式提高可读性');
    score -= 0.1;
  }

  const hasUppercaseFirst = /^[A-Z]/.test(answer.trim());
  const isChinese = /[\u4e00-\u9fa5]/.test(answer);
  if (!isChinese && !hasUppercaseFirst && answer.trim().length > 0) {
    issues.push('英文句子首字母应大写');
    score -= 0.1;
  }

  return { score: Math.max(0, score), issues };
}

export function evaluateAnswer(
  answer: string,
  standardAnswer: string,
  customWeights?: Partial<EvaluationWeights>,
): AutoEvaluation {
  const weights = customWeights ? { ...getWeights(), ...customWeights } : getWeights();

  const semanticSimilarity = calculateSemanticSimilarity(answer, standardAnswer);
  const keyInfoResult = calculateKeyInfoCoverage(answer, standardAnswer);
  const factualResult = calculateFactualAccuracy(answer, standardAnswer);
  const formatResult = calculateFormatNormativity(answer);

  const dimensions: DimensionScore = {
    semanticSimilarity,
    keyInfoCoverage: keyInfoResult.score,
    factualAccuracy: factualResult.score,
    formatNormativity: formatResult.score,
  };

  const weightedScore =
    dimensions.semanticSimilarity * weights.semanticSimilarity +
    dimensions.keyInfoCoverage * weights.keyInfoCoverage +
    dimensions.factualAccuracy * weights.factualAccuracy +
    dimensions.formatNormativity * weights.formatNormativity;

  let suggestedJudgment: HumanJudgment;
  if (weightedScore >= weights.correctThreshold) {
    suggestedJudgment = 'correct';
  } else if (weightedScore >= weights.partialThreshold) {
    suggestedJudgment = 'partial';
  } else {
    suggestedJudgment = 'wrong';
  }

  const confidence = calculateConfidence(dimensions, weightedScore);

  return {
    dimensions,
    weightedScore,
    suggestedJudgment,
    confidence,
    analysis: {
      matchedKeywords: keyInfoResult.matched,
      missingKeywords: keyInfoResult.missing,
      factualErrors: factualResult.errors,
      formatIssues: formatResult.issues,
    },
    evaluatedAt: Date.now(),
  };
}

function calculateConfidence(dimensions: DimensionScore, weightedScore: number): number {
  const scores = Object.values(dimensions);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  const consistencyFactor = Math.max(0, 1 - stdDev * 2);
  const scoreFactor = Math.min(1, weightedScore * 0.5 + 0.5);

  return (consistencyFactor * 0.4 + scoreFactor * 0.6);
}

export function batchEvaluateResults(
  results: QAResult[],
  customWeights?: Partial<EvaluationWeights>,
): { results: QAResult[]; stats: EvaluationMetrics['autoEvalStats'] } {
  const evaluatedResults: QAResult[] = [];
  let semanticSum = 0;
  let keyInfoSum = 0;
  let factualSum = 0;
  let formatSum = 0;
  let weightedSum = 0;
  let autoCorrect = 0;
  let evaluatedCount = 0;

  for (const r of results) {
    if (r.standardAnswer) {
      const autoEval = evaluateAnswer(r.answer, r.standardAnswer, customWeights);
      evaluatedResults.push({
        ...r,
        autoEvaluation: autoEval,
      });

      semanticSum += autoEval.dimensions.semanticSimilarity;
      keyInfoSum += autoEval.dimensions.keyInfoCoverage;
      factualSum += autoEval.dimensions.factualAccuracy;
      formatSum += autoEval.dimensions.formatNormativity;
      weightedSum += autoEval.weightedScore;
      evaluatedCount++;

      if (r.humanJudgment && r.humanJudgment === autoEval.suggestedJudgment) {
        autoCorrect++;
      }
    } else {
      evaluatedResults.push(r);
    }
  }

  const stats: EvaluationMetrics['autoEvalStats'] = {
    avgSemanticSimilarity: evaluatedCount > 0 ? semanticSum / evaluatedCount : 0,
    avgKeyInfoCoverage: evaluatedCount > 0 ? keyInfoSum / evaluatedCount : 0,
    avgFactualAccuracy: evaluatedCount > 0 ? factualSum / evaluatedCount : 0,
    avgFormatNormativity: evaluatedCount > 0 ? formatSum / evaluatedCount : 0,
    avgWeightedScore: evaluatedCount > 0 ? weightedSum / evaluatedCount : 0,
    autoAccuracy: evaluatedCount > 0 ? autoCorrect / evaluatedCount : 0,
    autoJudgmentCount: evaluatedCount,
  };

  return { results: evaluatedResults, stats };
}

export function getSuggestedJudgment(
  weightedScore: number,
  weights?: Partial<EvaluationWeights>,
): HumanJudgment {
  const w = weights ? { ...getWeights(), ...weights } : getWeights();
  if (weightedScore >= w.correctThreshold) return 'correct';
  if (weightedScore >= w.partialThreshold) return 'partial';
  return 'wrong';
}
