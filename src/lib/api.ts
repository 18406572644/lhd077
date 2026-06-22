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
  BackupInfo,
  BackupListResult,
  RestoreResult,
  ScheduledEvaluationTask,
  ScheduledExecutionRecord,
  ScheduledAlert,
  NotificationMessage,
  TrendReport,
  ScheduleConfig,
  NotificationConfig,
  AlertThresholdConfig,
  Tag,
  TaggableType,
  ABCompareResult,
  ParamsRecommendation,
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
    askAB(params: {
      question: string;
      versionId: string;
      paramsA?: Partial<RetrievalParams>;
      paramsB?: Partial<RetrievalParams>;
      modelConfig?: ModelConfig;
      standardAnswer?: string;
    }): Promise<ABCompareResult> {
      return request<ABCompareResult>("/qa/ask/ab", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    getParamsRecommendation(versionId: string): Promise<ParamsRecommendation> {
      return request<ParamsRecommendation>(
        `/qa/recommendation/params?versionId=${encodeURIComponent(versionId)}`,
      );
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

  backup: {
    list(): Promise<BackupListResult> {
      return request<BackupListResult>("/backup");
    },
    createFull(description?: string): Promise<{ success: boolean; backup: BackupInfo }> {
      return request("/backup/full", {
        method: "POST",
        body: JSON.stringify({ description }),
      });
    },
    createIncremental(description?: string): Promise<{ success: boolean; backup: BackupInfo }> {
      return request("/backup/incremental", {
        method: "POST",
        body: JSON.stringify({ description }),
      });
    },
    get(id: string): Promise<{ success: boolean; backup: BackupInfo }> {
      return request(`/backup/${encodeURIComponent(id)}`);
    },
    restore(id: string): Promise<RestoreResult & { success: boolean }> {
      return request(`/backup/${encodeURIComponent(id)}/restore`, {
        method: "POST",
      });
    },
    rollback(id: string): Promise<RestoreResult & { success: boolean }> {
      return request(`/backup/${encodeURIComponent(id)}/rollback`, {
        method: "POST",
      });
    },
    remove(id: string): Promise<{ success: boolean; message?: string }> {
      return request(`/backup/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    downloadUrl(id: string): string {
      return `${API_BASE}/backup/${encodeURIComponent(id)}/download`;
    },
    importFile(file: File): Promise<{ success: boolean; backup: BackupInfo }> {
      const fd = new FormData();
      fd.append("file", file);
      return request("/backup/import", {
        method: "POST",
        body: fd,
      });
    },
  },

  scheduledEvaluation: {
    listTasks(): Promise<ScheduledEvaluationTask[]> {
      return request<ScheduledEvaluationTask[]>("/scheduled-evaluation/tasks");
    },
    getTask(id: string): Promise<ScheduledEvaluationTask> {
      return request<ScheduledEvaluationTask>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}`,
      );
    },
    createTask(params: {
      name: string;
      description?: string;
      testSet: TestCase[];
      testSetFile?: File;
      versionId: string;
      retrievalParams?: Partial<RetrievalParams>;
      modelConfig?: ModelConfig;
      metricIds?: string[];
      schedule: ScheduleConfig;
      notification: NotificationConfig;
      alertThresholds: AlertThresholdConfig;
    }): Promise<ScheduledEvaluationTask> {
      const fd = new FormData();
      fd.append("name", params.name);
      fd.append("versionId", params.versionId);
      fd.append("schedule", JSON.stringify(params.schedule));
      fd.append("notification", JSON.stringify(params.notification));
      fd.append("alertThresholds", JSON.stringify(params.alertThresholds));
      if (params.description) fd.append("description", params.description);
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
      return request<ScheduledEvaluationTask>("/scheduled-evaluation/tasks", {
        method: "POST",
        body: fd,
      });
    },
    updateTask(
      id: string,
      patch: Partial<{
        name: string;
        description: string;
        schedule: ScheduleConfig;
        notification: NotificationConfig;
        alertThresholds: AlertThresholdConfig;
        status: ScheduledEvaluationTask["status"];
      }>,
    ): Promise<ScheduledEvaluationTask> {
      return request<ScheduledEvaluationTask>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          body: JSON.stringify(patch),
        },
      );
    },
    deleteTask(id: string): Promise<{ success: boolean }> {
      return request(`/scheduled-evaluation/tasks/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    pauseTask(id: string): Promise<ScheduledEvaluationTask> {
      return request<ScheduledEvaluationTask>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}/pause`,
        {
          method: "POST",
        },
      );
    },
    resumeTask(id: string): Promise<ScheduledEvaluationTask> {
      return request<ScheduledEvaluationTask>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}/resume`,
        {
          method: "POST",
        },
      );
    },
    runTaskNow(id: string): Promise<ScheduledExecutionRecord> {
      return request<ScheduledExecutionRecord>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}/run`,
        {
          method: "POST",
        },
      );
    },
    listExecutions(id: string): Promise<ScheduledExecutionRecord[]> {
      return request<ScheduledExecutionRecord[]>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}/executions`,
      );
    },
    getTrendReport(id: string, days?: number): Promise<TrendReport> {
      const q = days ? `?days=${days}` : "";
      return request<TrendReport>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}/trend${q}`,
      );
    },
    listNotifications(id: string): Promise<NotificationMessage[]> {
      return request<NotificationMessage[]>(
        `/scheduled-evaluation/tasks/${encodeURIComponent(id)}/notifications`,
      );
    },
    listAlerts(params?: {
      scheduledTaskId?: string;
      onlyUnacknowledged?: boolean;
    }): Promise<ScheduledAlert[]> {
      const qs = new URLSearchParams();
      if (params?.scheduledTaskId) qs.set("scheduledTaskId", params.scheduledTaskId);
      if (params?.onlyUnacknowledged) qs.set("onlyUnacknowledged", "true");
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return request<ScheduledAlert[]>(`/scheduled-evaluation/alerts${q}`);
    },
    acknowledgeAlert(id: string): Promise<ScheduledAlert> {
      return request<ScheduledAlert>(
        `/scheduled-evaluation/alerts/${encodeURIComponent(id)}/acknowledge`,
        {
          method: "POST",
        },
      );
    },
    acknowledgeAllAlerts(taskId: string): Promise<{ success: boolean; acknowledged: number }> {
      return request(
        `/scheduled-evaluation/tasks/${encodeURIComponent(taskId)}/alerts/acknowledge-all`,
        {
          method: "POST",
        },
      );
    },
    validateCron(cronExpression: string): Promise<{ valid: boolean; message: string }> {
      return request("/scheduled-evaluation/validate-cron", {
        method: "POST",
        body: JSON.stringify({ cronExpression }),
      });
    },
    validateNotification(config: NotificationConfig): Promise<{ valid: boolean; errors: string[] }> {
      return request("/scheduled-evaluation/validate-notification", {
        method: "POST",
        body: JSON.stringify(config),
      });
    },
  },

  tags: {
    list(): Promise<Tag[]> {
      return request<Tag[]>("/tags");
    },
    getTree(): Promise<Tag[]> {
      return request<Tag[]>("/tags/tree");
    },
    get(id: string): Promise<Tag> {
      return request<Tag>(`/tags/${encodeURIComponent(id)}`);
    },
    create(params: {
      name: string;
      color: string;
      parentId?: string | null;
      description?: string;
    }): Promise<Tag> {
      return request<Tag>("/tags", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    update(
      id: string,
      params: Partial<{
        name: string;
        color: string;
        parentId: string | null;
        description: string;
      }>,
    ): Promise<Tag> {
      return request<Tag>(`/tags/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(params),
      });
    },
    remove(id: string): Promise<{ success: boolean; deletedCount: number }> {
      return request(`/tags/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    getAncestors(id: string): Promise<Tag[]> {
      return request<Tag[]>(`/tags/${encodeURIComponent(id)}/ancestors`);
    },
    getDescendants(id: string): Promise<Tag[]> {
      return request<Tag[]>(`/tags/${encodeURIComponent(id)}/descendants`);
    },
    getEntityTags(targetType: TaggableType, targetId: string): Promise<Tag[]> {
      return request<Tag[]>(`/tags/${targetType}/${encodeURIComponent(targetId)}/tags`);
    },
    setEntityTags(
      targetType: TaggableType,
      targetId: string,
      tagIds: string[],
    ): Promise<{ success: boolean; tagIds: string[] }> {
      return request(`/tags/${targetType}/${encodeURIComponent(targetId)}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagIds }),
      });
    },
    filterByTags(
      targetType: TaggableType,
      tagIds: string[],
      matchAll?: boolean,
    ): Promise<{ targetIds: string[] }> {
      return request(`/tags/filter/${targetType}`, {
        method: "POST",
        body: JSON.stringify({ tagIds, matchAll }),
      });
    },
  },
};
