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

export interface DimensionScore {
  semanticSimilarity: number;
  keyInfoCoverage: number;
  factualAccuracy: number;
  formatNormativity: number;
}

export interface AutoEvaluation {
  dimensions: DimensionScore;
  weightedScore: number;
  suggestedJudgment: HumanJudgment;
  confidence: number;
  analysis: {
    matchedKeywords: string[];
    missingKeywords: string[];
    factualErrors: string[];
    formatIssues: string[];
  };
  evaluatedAt: number;
}

export interface EvaluationWeights {
  semanticSimilarity: number;
  keyInfoCoverage: number;
  factualAccuracy: number;
  formatNormativity: number;
  correctThreshold: number;
  partialThreshold: number;
}

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
  autoEvaluation?: AutoEvaluation;
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface TestCase {
  question: string;
  standardAnswer: string;
}

export type MetricComputeType = 'built-in' | 'custom';
export type BuiltInMetric = 'accuracy' | 'partialRate' | 'wrongRate' | 'avgConfidence';

export interface Metric {
  id: string;
  name: string;
  description: string;
  computeType: MetricComputeType;
  builtInType?: BuiltInMetric;
  customScript?: string;
  weight: number;
  higherIsBetter: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MetricResult {
  metricId: string;
  metricName: string;
  value: number;
  weight: number;
  higherIsBetter: boolean;
  weightedScore: number;
}

export interface EvaluationMetrics {
  accuracy: number;
  partialRate: number;
  wrongRate: number;
  avgConfidence: number;
  total: number;
  weightedTotalScore?: number;
  metricResults?: MetricResult[];
  metricConfigs?: Metric[];
  autoEvalStats?: {
    avgSemanticSimilarity: number;
    avgKeyInfoCoverage: number;
    avgFactualAccuracy: number;
    avgFormatNormativity: number;
    avgWeightedScore: number;
    autoAccuracy: number;
    autoJudgmentCount: number;
  };
}

export interface EvaluationTask {
  id: string;
  name: string;
  testSet: TestCase[];
  versionId: string;
  retrievalParams: RetrievalParams;
  modelConfig?: ModelConfig;
  metricIds: string[];
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

export type ImportPhase = 'parsing' | 'dedup' | 'splitting' | 'indexing' | 'completed' | 'cancelled' | 'failed';

export interface ImportProgress {
  taskId: string;
  phase: ImportPhase;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
  totalDocuments: number;
  processedDocuments: number;
  totalChunks: number;
  processedChunks: number;
  message: string;
  startedAt: number;
  updatedAt: number;
  result?: ImportResult;
  error?: string;
  cancelled: boolean;
  rollbackOnCancel?: boolean;
}

export interface ImportTask {
  id: string;
  progress: ImportProgress;
  cancelRequested: boolean;
  versionId?: string;
  createdDocIds: string[];
  createdChunkIds: string[];
}

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  affectedScope?: string;
  recoverable?: boolean;
};

export type BackupType = 'full' | 'incremental';

export interface BackupInfo {
  id: string;
  name: string;
  type: BackupType;
  createdAt: number;
  size: number;
  description?: string;
  baseBackupId?: string;
  dataFiles: string[];
  checksum: string;
}

export interface BackupListResult {
  backups: BackupInfo[];
  lastBackupAt?: number;
  totalSize: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  rollbackBackupId?: string;
  restoredAt: number;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'cron';

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export type NotificationType = 'desktop' | 'email';

export interface NotificationConfig {
  enabled: boolean;
  types: NotificationType[];
  emailAddresses?: string[];
  onSuccess?: boolean;
  onFailure?: boolean;
  onAlert?: boolean;
}

export interface AlertThresholdConfig {
  accuracyThreshold?: number;
  partialRateThreshold?: number;
  wrongRateThreshold?: number;
  weightedScoreThreshold?: number;
  consecutiveFailures?: number;
}

export type ScheduledTaskStatus = 'active' | 'paused' | 'disabled';

export interface ScheduledEvaluationTask {
  id: string;
  name: string;
  description?: string;
  baseEvaluationTaskId?: string;
  testSet: TestCase[];
  versionId: string;
  retrievalParams: RetrievalParams;
  modelConfig?: ModelConfig;
  metricIds: string[];
  schedule: ScheduleConfig;
  notification: NotificationConfig;
  alertThresholds: AlertThresholdConfig;
  status: ScheduledTaskStatus;
  lastRunAt?: number;
  nextRunAt?: number;
  lastRunResultId?: string;
  lastRunMetrics?: EvaluationMetrics;
  consecutiveAlertCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduledExecutionRecord {
  id: string;
  scheduledTaskId: string;
  evaluationTaskId: string;
  triggeredAt: number;
  startedAt: number;
  finishedAt?: number;
  status: TaskStatus;
  metrics?: EvaluationMetrics;
  alerts?: ScheduledAlert[];
  errorMessage?: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface ScheduledAlert {
  id: string;
  scheduledTaskId: string;
  executionId: string;
  severity: AlertSeverity;
  type: 'threshold_breached' | 'execution_failed' | 'consecutive_failures';
  message: string;
  metricName?: string;
  expectedValue?: number;
  actualValue?: number;
  triggeredAt: number;
  acknowledged: boolean;
}

export interface NotificationMessage {
  id: string;
  type: NotificationType;
  subject: string;
  body: string;
  scheduledTaskId?: string;
  executionId?: string;
  sentAt: number;
  success: boolean;
  errorMessage?: string;
}

export interface TrendDataPoint {
  timestamp: number;
  date: string;
  taskId: string;
  taskName: string;
  metrics: EvaluationMetrics;
}

export interface TrendReport {
  scheduledTaskId: string;
  scheduledTaskName: string;
  dataPoints: TrendDataPoint[];
  startDate: number;
  endDate: number;
  overallStats: {
    avgAccuracy: number;
    minAccuracy: number;
    maxAccuracy: number;
    trend: 'improving' | 'declining' | 'stable';
    totalRuns: number;
    alertCount: number;
  };
}
