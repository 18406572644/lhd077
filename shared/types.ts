export type KnowledgeSource = 'markdown' | 'faq' | 'history';

export interface KnowledgeDocument {
  id: string;
  versionId: string;
  title: string;
  source: KnowledgeSource;
  content: string;
  hash: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  chunkCount: number;
  createdAt: number;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  tokens: number;
}

export type IndexStatus = 'building' | 'ready' | 'corrupted';

export interface KnowledgeVersion {
  id: string;
  name: string;
  description: string;
  documentIds: string[];
  createdAt: number;
  indexStatus: IndexStatus;
  indexChecksum?: string;
}

export interface RetrievalParams {
  topK: number;
  minScore: number;
  chunkSize: number;
  chunkOverlap: number;
  useBM25: boolean;
}

export interface ModelConfig {
  name: string;
  temperature: number;
}

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  score: number;
  documentTitle: string;
}

export type HumanJudgment = 'correct' | 'partial' | 'wrong';

export interface QAResult {
  id: string;
  versionId: string;
  taskId?: string;
  question: string;
  retrievedChunks: RetrievedChunk[];
  answer: string;
  standardAnswer?: string;
  confidence: number;
  createdAt: number;
  paramsSnapshot: RetrievalParams & { modelConfig?: ModelConfig };
  humanJudgment?: HumanJudgment;
  humanNote?: string;
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface TestCase {
  question: string;
  standardAnswer: string;
}

export interface EvaluationMetrics {
  accuracy: number;
  partialRate: number;
  wrongRate: number;
  avgConfidence: number;
  total: number;
}

export interface EvaluationTask {
  id: string;
  name: string;
  testSet: TestCase[];
  versionId: string;
  retrievalParams: RetrievalParams;
  modelConfig?: ModelConfig;
  status: TaskStatus;
  resultIds: string[];
  metrics?: EvaluationMetrics;
  errorMessage?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'import' | 'index' | 'qa' | 'evaluation' | 'system';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, unknown>;
  affectedScope?: string;
  recoverable?: boolean;
}

export interface ConsistencyIssue {
  type: string;
  description: string;
  affectedIds: string[];
  fix?: string;
}

export interface ConsistencyReport {
  timestamp: number;
  issues: ConsistencyIssue[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
  };
}

export interface CompareRequest {
  taskIds: [string, string];
}

export interface CompareResult {
  taskA: EvaluationTask;
  taskB: EvaluationTask;
  metricDiffs: Record<string, number>;
  perQuestionDiff: Array<{
    question: string;
    judgmentA?: HumanJudgment;
    judgmentB?: HumanJudgment;
    confidenceA: number;
    confidenceB: number;
  }>;
}

export interface ImportResult {
  success: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ filename: string; message: string }>;
  versionId: string;
}

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  affectedScope?: string;
  recoverable?: boolean;
};
