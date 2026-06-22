import type {
  KnowledgeDocument,
  KnowledgeVersion,
  QAResult,
  RetrievalParams,
  ModelConfig,
  EvaluationTask,
  LogEntry,
  ImportResult,
  ImportProgress,
  ConsistencyReport,
  CompareResult,
  HumanJudgment,
  TestCase,
  Metric,
  BuiltInMetric,
  MetricComputeType,
  AutoEvaluation,
  EvaluationWeights,
} from "../../shared/types";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    ...options,
  });
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : (undefined as unknown as T);
  } catch {
    data = text as unknown as T;
  }
  if (!res.ok) {
    const err = (data as unknown as { message?: string; code?: string }) || {};
    throw new Error(err.message || `请求失败: ${res.status}`);
  }
  return data;
}

export const api = {
  knowledge: {
    import(
      files: File[],
      versionName?: string,
      retrievalParams?: Partial<RetrievalParams>,
    ): Promise<ImportResult> {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      if (versionName) fd.append("versionName", versionName);
      if (retrievalParams)
        fd.append("retrievalParams", JSON.stringify(retrievalParams));
      return request<ImportResult>("/knowledge/import", {
        method: "POST",
        body: fd,
      });
    },
    importAsync(
      files: File[],
      versionName?: string,
      retrievalParams?: Partial<RetrievalParams>,
    ): Promise<{ taskId: string }> {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      if (versionName) fd.append("versionName", versionName);
      if (retrievalParams)
        fd.append("retrievalParams", JSON.stringify(retrievalParams));
      return request<{ taskId: string }>("/knowledge/import/async", {
        method: "POST",
        body: fd,
      });
    },
    getImportProgress(taskId: string): Promise<ImportProgress> {
      return request<ImportProgress>(`/knowledge/import/progress/${encodeURIComponent(taskId)}`);
    },
    cancelImport(taskId: string, rollback: boolean): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/knowledge/import/cancel/${encodeURIComponent(taskId)}`, {
        method: "POST",
        body: JSON.stringify({ rollback }),
      });
    },
    listVersions(): Promise<KnowledgeVersion[]> {
      return request<KnowledgeVersion[]>("/knowledge/versions");
    },
    listDocuments(versionId?: string): Promise<KnowledgeDocument[]> {
      const q = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
      return request<KnowledgeDocument[]>(`/knowledge/documents${q}`);
    },
    deleteDocument(id: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/knowledge/documents/${id}`, {
        method: "DELETE",
      });
    },
    getIndexStatus(versionId: string): Promise<{
      versionId: string;
      status: string;
      checksumValid: boolean;
      totalChunks: number;
      builtAt?: number;
      checksum?: string;
    }> {
      return request(`/knowledge/index/status?versionId=${encodeURIComponent(versionId)}`);
    },
    rebuildIndex(versionId: string): Promise<{ success: boolean }> {
      return request("/knowledge/index/rebuild", {
        method: "POST",
        body: JSON.stringify({ versionId }),
      });
    },
  },

  qa: {
    ask(params: {
      question: string;
      versionId: string;
      retrievalParams?: Partial<RetrievalParams>;
      modelConfig?: ModelConfig;
      standardAnswer?: string;
    }): Promise<QAResult> {
      return request<QAResult>("/qa/ask", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    annotate(params: {
      resultId: string;
      judgment: HumanJudgment;
      note?: string;
      standardAnswer?: string;
    }): Promise<QAResult> {
      return request<QAResult>("/qa/annotate", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    listResults(params?: {
      versionId?: string;
      taskId?: string;
    }): Promise<QAResult[]> {
      const qs = new URLSearchParams();
      if (params?.versionId) qs.set("versionId", params.versionId);
      if (params?.taskId) qs.set("taskId", params.taskId);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return request<QAResult[]>(`/qa/results${q}`);
    },
  },

  evaluation: {
    listTasks(): Promise<EvaluationTask[]> {
      return request<EvaluationTask[]>("/evaluation/tasks");
    },
    createTask(params: {
      name: string;
      testSet: TestCase[];
      versionId: string;
      retrievalParams?: Partial<RetrievalParams>;
      modelConfig?: ModelConfig;
      testSetFile?: File;
      metricIds?: string[];
    }): Promise<EvaluationTask> {
      const fd = new FormData();
      fd.append("name", params.name);
      fd.append("versionId", params.versionId);
      if (params.testSetFile) {
        fd.append("testSet", params.testSetFile);
      } else if (params.testSet) {
        fd.append("testSet", JSON.stringify(params.testSet));
      }
      if (params.retrievalParams)
        fd.append("retrievalParams", JSON.stringify(params.retrievalParams));
      if (params.modelConfig)
        fd.append("modelConfig", JSON.stringify(params.modelConfig));
      if (params.metricIds)
        fd.append("metricIds", JSON.stringify(params.metricIds));
      return request<EvaluationTask>("/evaluation/tasks", {
        method: "POST",
        body: fd,
      });
    },
    runTask(id: string): Promise<EvaluationTask> {
      return request<EvaluationTask>(`/evaluation/tasks/${id}/run`, {
        method: "POST",
      });
    },
    getTaskResults(id: string): Promise<{ task: EvaluationTask; results: QAResult[] }> {
      return request(`/evaluation/tasks/${id}/results`);
    },
    exportTask(id: string): string {
      return `${API_BASE}/evaluation/tasks/${id}/export`;
    },
    getWeights(): Promise<EvaluationWeights> {
      return request<EvaluationWeights>("/evaluation/weights");
    },
    setWeights(weights: Partial<EvaluationWeights>): Promise<EvaluationWeights> {
      return request<EvaluationWeights>("/evaluation/weights", {
        method: "PUT",
        body: JSON.stringify(weights),
      });
    },
    resetWeights(): Promise<EvaluationWeights> {
      return request<EvaluationWeights>("/evaluation/weights/reset", {
        method: "POST",
      });
    },
    evaluateAnswer(params: {
      answer: string;
      standardAnswer: string;
      weights?: Partial<EvaluationWeights>;
    }): Promise<AutoEvaluation> {
      return request<AutoEvaluation>("/evaluation/evaluate", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    reEvaluateTask(id: string, weights?: Partial<EvaluationWeights>): Promise<EvaluationTask> {
      return request<EvaluationTask>(`/evaluation/tasks/${id}/re-evaluate`, {
        method: "POST",
        body: JSON.stringify({ weights }),
      });
    },
    applyAutoJudgment(resultId: string): Promise<QAResult> {
      return request<QAResult>(`/evaluation/results/${resultId}/apply-judgment`, {
        method: "POST",
      });
    },
    batchApplyAutoJudgments(taskId: string): Promise<{ updated: number; total: number }> {
      return request(`/evaluation/tasks/${taskId}/apply-judgments`, {
        method: "POST",
      });
    },
  },

  metrics: {
    list(): Promise<Metric[]> {
      return request<Metric[]>("/metrics");
    },
    get(id: string): Promise<Metric> {
      return request<Metric>(`/metrics/${id}`);
    },
    create(params: {
      name: string;
      description: string;
      computeType: MetricComputeType;
      builtInType?: BuiltInMetric;
      customScript?: string;
      weight: number;
      higherIsBetter: boolean;
    }): Promise<Metric> {
      return request<Metric>("/metrics", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    update(
      id: string,
      params: Partial<{
        name: string;
        description: string;
        computeType: MetricComputeType;
        builtInType?: BuiltInMetric;
        customScript?: string;
        weight: number;
        higherIsBetter: boolean;
      }>,
    ): Promise<Metric> {
      return request<Metric>(`/metrics/${id}`, {
        method: "PUT",
        body: JSON.stringify(params),
      });
    },
    remove(id: string): Promise<{ success: boolean }> {
      return request(`/metrics/${id}`, {
        method: "DELETE",
      });
    },
    testScript(script: string): Promise<{ success: boolean; value?: number; error?: string }> {
      return request("/metrics/test-script", {
        method: "POST",
        body: JSON.stringify({ script }),
      });
    },
  },

  compare: {
    run(taskIds: [string, string]): Promise<CompareResult> {
      return request<CompareResult>("/compare", {
        method: "POST",
        body: JSON.stringify({ taskIds }),
      });
    },
    exportUrl(taskIds: [string, string]): string {
      return `${API_BASE}/compare/export`;
    },
    async export(taskIds: [string, string]): Promise<void> {
      const res = await fetch(`${API_BASE}/compare/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compare_${taskIds[0]}_vs_${taskIds[1]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },

  logs: {
    list(params?: { level?: string; category?: string }): Promise<LogEntry[]> {
      const qs = new URLSearchParams();
      if (params?.level) qs.set("level", params.level);
      if (params?.category) qs.set("category", params.category);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return request<LogEntry[]>(`/logs${q}`);
    },
    consistencyCheck(): Promise<ConsistencyReport> {
      return request<ConsistencyReport>("/logs/consistency");
    },
    exportUrl(params?: { level?: string; category?: string }): string {
      const qs = new URLSearchParams();
      if (params?.level) qs.set("level", params.level);
      if (params?.category) qs.set("category", params.category);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return `${API_BASE}/logs/export${q}`;
    },
  },
};
