import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Play,
  Download,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Gauge,
  Calculator,
  Code2,
  Settings,
  Sparkles,
  Brain,
  Target,
  CheckSquare,
  AlertTriangle,
  Zap,
  RotateCcw,
  Check,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import VersionSelector from "@/components/VersionSelector";
import type {
  EvaluationTask,
  QAResult,
  HumanJudgment,
  TestCase,
  Metric,
  EvaluationWeights,
} from "../../shared/types";

export default function Evaluation() {
  const { selectedVersionId, retrievalParams, setVersions, showToast } =
    useAppStore();
  const [tasks, setTasks] = useState<EvaluationTask[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [testSetText, setTestSetText] = useState(
    '[\n  {"question": "如何重置密码？", "standardAnswer": "点击登录页的忘记密码，通过邮箱验证重置"},\n  {"question": "支持哪些支付方式？", "standardAnswer": "支持支付宝、微信支付和银行卡"}\n]',
  );
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<EvaluationTask | null>(null);
  const [taskResults, setTaskResults] = useState<QAResult[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [testSetFile, setTestSetFile] = useState<File | null>(null);
  const [showWeightsConfig, setShowWeightsConfig] = useState(false);
  const [weights, setWeights] = useState<EvaluationWeights | null>(null);
  const [tempWeights, setTempWeights] = useState<Partial<EvaluationWeights>>({});
  const [reevaluatingId, setReevaluatingId] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  useEffect(() => {
    api.knowledge.listVersions().then(setVersions);
    loadTasks();
    loadMetrics();
    loadWeights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVersions]);

  const loadTasks = async () => {
    const list = await api.evaluation.listTasks();
    setTasks(list);
  };

  const loadMetrics = async () => {
    try {
      const list = await api.metrics.list();
      setMetrics(list);
    } catch {
      // 静默失败，指标为空也能正常使用
    }
  };

  const loadWeights = async () => {
    try {
      const w = await api.evaluation.getWeights();
      setWeights(w);
      setTempWeights(w);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载权重失败", "error");
    }
  };

  const handleCreate = async () => {
    if (!selectedVersionId) {
      showToast("请选择知识库版本", "error");
      return;
    }
    if (!taskName.trim()) {
      showToast("请输入任务名称", "error");
      return;
    }
    let testSet: TestCase[] = [];
    if (testSetFile) {
      // file will be sent directly
    } else {
      try {
        testSet = JSON.parse(testSetText);
      } catch {
        showToast("测试集 JSON 格式错误", "error");
        return;
      }
    }
    if (!testSetFile && (!Array.isArray(testSet) || testSet.length === 0)) {
      showToast("请提供有效的测试集", "error");
      return;
    }
    try {
      await api.evaluation.createTask({
        name: taskName,
        testSet,
        versionId: selectedVersionId,
        retrievalParams,
        testSetFile: testSetFile || undefined,
        metricIds: selectedMetricIds,
      });
      showToast("任务已创建", "success");
      setShowCreate(false);
      setTaskName("");
      setTestSetFile(null);
      setSelectedMetricIds([]);
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "创建失败", "error");
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await api.evaluation.runTask(id);
      showToast("评测已完成", "success");
      loadTasks();
      if (selectedTask?.id === id) {
        const data = await api.evaluation.getTaskResults(id);
        setSelectedTask(data.task);
        setTaskResults(data.results);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "执行失败", "error");
    } finally {
      setRunningId(null);
    }
  };

  const handleViewResults = async (task: EvaluationTask) => {
    setSelectedTask(task);
    if (task.status === "done") {
      const data = await api.evaluation.getTaskResults(task.id);
      setTaskResults(data.results);
    } else {
      setTaskResults([]);
    }
  };

  const handleAnnotate = async (
    r: QAResult,
    judgment: HumanJudgment,
  ) => {
    try {
      const updated = await api.qa.annotate({
        resultId: r.id,
        judgment,
      });
      setTaskResults((list) =>
        list.map((x) => (x.id === r.id ? updated : x)),
      );
      loadTasks();
      showToast("已保存判定", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  const statusBadge = (s: string) => {
    if (s === "done")
      return (
        <span className="badge bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> 已完成
        </span>
      );
    if (s === "running")
      return (
        <span className="badge bg-blue-50 text-blue-700">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 运行中
        </span>
      );
    if (s === "failed")
      return (
        <span className="badge bg-red-50 text-red-700">
          <XCircle className="w-3 h-3 mr-1" /> 失败
        </span>
      );
    return (
      <span className="badge bg-slate-100 text-slate-500">
        <Clock className="w-3 h-3 mr-1" /> 待运行
      </span>
    );
  };

  const judgmentIcon = (j?: HumanJudgment) => {
    if (j === "correct") return <ThumbsUp className="w-3 h-3 text-emerald-500" />;
    if (j === "partial") return <Minus className="w-3 h-3 text-amber-500" />;
    if (j === "wrong") return <ThumbsDown className="w-3 h-3 text-red-500" />;
    return <span className="text-slate-300">—</span>;
  };

  const judgmentBadgeClass = (j?: HumanJudgment) => {
    if (j === "correct") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (j === "partial") return "bg-amber-50 text-amber-700 border-amber-200";
    if (j === "wrong") return "bg-red-50 text-red-700 border-red-200";
    return "bg-slate-50 text-slate-500 border-slate-200";
  };

  const handleSaveWeights = async () => {
    try {
      const updated = await api.evaluation.setWeights(tempWeights);
      setWeights(updated);
      setShowWeightsConfig(false);
      showToast("权重配置已保存", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  const handleResetWeights = async () => {
    if (!confirm("确定要重置为默认权重吗？")) return;
    try {
      const reset = await api.evaluation.resetWeights();
      setWeights(reset);
      setTempWeights(reset);
      showToast("已重置为默认权重", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "重置失败", "error");
    }
  };

  const handleReEvaluate = async (taskId: string) => {
    setReevaluatingId(taskId);
    try {
      await api.evaluation.reEvaluateTask(taskId, tempWeights);
      showToast("重新评估完成", "success");
      loadTasks();
      if (selectedTask?.id === taskId) {
        const data = await api.evaluation.getTaskResults(taskId);
        setSelectedTask(data.task);
        setTaskResults(data.results);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "重新评估失败", "error");
    } finally {
      setReevaluatingId(null);
    }
  };

  const handleApplyAutoJudgment = async (r: QAResult) => {
    if (!r.autoEvaluation) return;
    try {
      const updated = await api.evaluation.applyAutoJudgment(r.id);
      setTaskResults((list) =>
        list.map((x) => (x.id === r.id ? updated : x)),
      );
      loadTasks();
      showToast("已应用自动判定", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "应用失败", "error");
    }
  };

  const handleBatchApplyAutoJudgments = async (taskId: string) => {
    if (!confirm("确定要批量应用所有未人工判定的自动判定结果吗？")) return;
    try {
      const result = await api.evaluation.batchApplyAutoJudgments(taskId);
      showToast(`已应用 ${result.updated}/${result.total} 条判定`, "success");
      loadTasks();
      if (selectedTask?.id === taskId) {
        const data = await api.evaluation.getTaskResults(taskId);
        setSelectedTask(data.task);
        setTaskResults(data.results);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "批量应用失败", "error");
    }
  };

  const ScoreBar = ({
    score,
    label,
    icon: Icon,
    color,
  }: {
    score: number;
    label: string;
    icon: React.ElementType;
    color: string;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-600">
          <Icon className="w-3 h-3" /> {label}
        </span>
        <span className={`font-mono font-medium ${color}`}>
          {(score * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 0.75
              ? "bg-emerald-500"
              : score >= 0.4
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="批量评测"
        description="导入测试集批量运行问答，智能多维度自动评估答案质量"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (weights) setTempWeights(weights);
                setShowWeightsConfig(true);
              }}
              className="btn-secondary"
            >
              <Settings className="w-4 h-4" /> 评估权重
            </button>
            <VersionSelector />
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> 新建评测任务
            </button>
          </div>
        }
      />

      {showCreate && (
        <div className="card p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary-600" />
              <span className="font-medium text-slate-700">创建评测任务</span>
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">任务名称</label>
              <input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="例如：基线测试 v1"
                className="input py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                上传测试集文件（可选，JSON/CSV）
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv,.tsv"
                className="input py-1.5 text-sm"
                onChange={(e) => setTestSetFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-slate-500 mb-1">
              或直接粘贴测试集 JSON
            </label>
            <textarea
              value={testSetText}
              onChange={(e) => setTestSetText(e.target.value)}
              rows={6}
              className="input font-mono text-xs resize-none"
            />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-slate-500">
                <Gauge className="w-3.5 h-3.5 inline mr-1" />
                选择评测指标（可多选，系统自动计算加权总分）
              </label>
              <span className="text-xs text-slate-400">
                已选 {selectedMetricIds.length} 个
              </span>
            </div>
            {metrics.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-400">
                  暂无自定义指标，使用默认指标
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                {metrics.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMetricIds((prev) =>
                        prev.includes(m.id)
                          ? prev.filter((id) => id !== m.id)
                          : [...prev, m.id],
                      );
                    }}
                    className={`p-2 text-left rounded-lg border transition-all text-xs ${
                      selectedMetricIds.includes(m.id)
                        ? "border-primary-400 bg-primary-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {m.computeType === "built-in" ? (
                        <Calculator className="w-3 h-3 text-primary-500" />
                      ) : (
                        <Code2 className="w-3 h-3 text-amber-500" />
                      )}
                      <span className="font-medium text-slate-700 truncate">
                        {m.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      权重: {m.weight}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">
              取消
            </button>
            <button onClick={handleCreate} className="btn-primary">
              创建任务
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="font-medium text-sm text-slate-700">
                评测任务（{tasks.length}）
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {tasks.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">
                  暂无评测任务
                </p>
              )}
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedTask?.id === t.id
                      ? "bg-primary-50 border-l-4 border-primary-500"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => handleViewResults(t)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-700 truncate">
                      {t.name}
                    </span>
                    {statusBadge(t.status)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mb-2">
                    {t.testSet.length} 条用例 ·{" "}
                    {new Date(t.createdAt).toLocaleString("zh-CN")}
                  </div>
                  {t.metrics && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-emerald-600 font-mono">
                        准确率 {(t.metrics.accuracy * 100).toFixed(1)}%
                      </span>
                      <span className="text-amber-600 font-mono">
                        部分 {(t.metrics.partialRate * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-400 font-mono">
                        置信度 {(t.metrics.avgConfidence * 100).toFixed(0)}%
                      </span>
                      {t.metrics.autoEvalStats && (
                        <span className="text-violet-600 font-mono">
                          <Sparkles className="w-3 h-3 inline mr-0.5" />
                          智能 {(t.metrics.autoEvalStats.avgWeightedScore * 100).toFixed(1)}%
                        </span>
                      )}
                      {t.metrics.weightedTotalScore !== undefined &&
                        t.metricIds.length > 0 && (
                          <span className="text-primary-600 font-mono font-medium">
                            加权 {(t.metrics.weightedTotalScore * 100).toFixed(1)}%
                          </span>
                        )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    {t.status !== "done" && t.status !== "running" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRun(t.id);
                        }}
                        disabled={runningId === t.id}
                        className="btn-success !py-1 !px-2 text-xs"
                      >
                        <Play className="w-3 h-3" />
                        {runningId === t.id ? "运行中" : "运行"}
                      </button>
                    )}
                    {t.status === "done" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReEvaluate(t.id);
                          }}
                          disabled={reevaluatingId === t.id}
                          className="btn-secondary !py-1 !px-2 text-xs"
                        >
                          <RotateCcw
                            className={`w-3 h-3 ${reevaluatingId === t.id ? "animate-spin" : ""}`}
                          />{" "}
                          {reevaluatingId === t.id ? "重评中" : "重评"}
                        </button>
                        <a
                          href={api.evaluation.exportTask(t.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="btn-secondary !py-1 !px-2 text-xs"
                        >
                          <Download className="w-3 h-3" /> 导出
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <div className="card">
            {!selectedTask ? (
              <div className="p-16 text-center text-slate-400">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>请选择一个评测任务查看详情</p>
              </div>
            ) : (
              <div>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">
                      {selectedTask.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedTask.testSet.length} 条用例 ·{" "}
                      {new Date(selectedTask.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  {selectedTask.metrics && (
                    <div>
                      <div className="flex gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-emerald-600">
                            {(selectedTask.metrics.accuracy * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">准确率</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-amber-600">
                            {(selectedTask.metrics.partialRate * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">部分正确</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-red-500">
                            {(selectedTask.metrics.wrongRate * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">错误率</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-serif font-bold text-primary-600">
                            {(selectedTask.metrics.avgConfidence * 100).toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">平均置信度</div>
                        </div>
                        {selectedTask.metrics.autoEvalStats && (
                          <div className="text-center pl-3 border-l border-slate-200">
                            <div className="text-2xl font-serif font-bold text-violet-600">
                              {(selectedTask.metrics.autoEvalStats.avgWeightedScore * 100).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> 智能评分
                            </div>
                          </div>
                        )}
                        {selectedTask.metrics.weightedTotalScore !== undefined &&
                          selectedTask.metricIds.length > 0 && (
                            <div className="text-center pl-3 border-l border-slate-200">
                              <div className="text-2xl font-serif font-bold text-indigo-600">
                                {(selectedTask.metrics.weightedTotalScore * 100).toFixed(0)}%
                              </div>
                              <div className="text-[10px] text-slate-400">加权总分</div>
                            </div>
                          )}
                      </div>
                      {selectedTask.metrics.autoEvalStats && (
                        <div className="grid grid-cols-4 gap-2 pt-2 pb-2 border-t border-slate-100 mb-2">
                          <div className="text-center p-1.5 bg-violet-50/50 rounded">
                            <div className="text-sm font-mono font-bold text-violet-600">
                              {(selectedTask.metrics.autoEvalStats.avgSemanticSimilarity * 100).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-500">语义相似度</div>
                          </div>
                          <div className="text-center p-1.5 bg-blue-50/50 rounded">
                            <div className="text-sm font-mono font-bold text-blue-600">
                              {(selectedTask.metrics.autoEvalStats.avgKeyInfoCoverage * 100).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-500">信息覆盖率</div>
                          </div>
                          <div className="text-center p-1.5 bg-emerald-50/50 rounded">
                            <div className="text-sm font-mono font-bold text-emerald-600">
                              {(selectedTask.metrics.autoEvalStats.avgFactualAccuracy * 100).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-500">事实准确性</div>
                          </div>
                          <div className="text-center p-1.5 bg-amber-50/50 rounded">
                            <div className="text-sm font-mono font-bold text-amber-600">
                              {(selectedTask.metrics.autoEvalStats.avgFormatNormativity * 100).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-500">格式规范性</div>
                          </div>
                        </div>
                      )}
                      {selectedTask.metrics.metricResults &&
                        selectedTask.metrics.metricResults.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            {selectedTask.metrics.metricResults.map((mr) => (
                              <div
                                key={mr.metricId}
                                className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded text-xs"
                              >
                                <span className="text-slate-600">{mr.metricName}</span>
                                <span
                                  className={`font-mono font-medium ${
                                    mr.higherIsBetter ? "text-emerald-600" : "text-red-500"
                                  }`}
                                >
                                  {(mr.value * 100).toFixed(1)}%
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                  ×{mr.weight}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
                {selectedTask.status === "done" && taskResults.length > 0 && (
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="text-xs text-slate-500">
                      <Sparkles className="w-3 h-3 inline mr-1 text-violet-500" />
                      系统已自动完成 {taskResults.filter(r => r.autoEvaluation).length} 条答案评估
                      {selectedTask.metrics?.autoEvalStats && (
                        <span className="ml-2 text-violet-600">
                          与人工判定一致率 {(selectedTask.metrics.autoEvalStats.autoAccuracy * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBatchApplyAutoJudgments(selectedTask.id)}
                        className="btn-secondary !py-1 !px-3 text-xs"
                      >
                        <CheckSquare className="w-3 h-3 mr-1" /> 批量应用自动判定
                      </button>
                      <button
                        onClick={() => handleReEvaluate(selectedTask.id)}
                        disabled={reevaluatingId === selectedTask.id}
                        className="btn-secondary !py-1 !px-3 text-xs"
                      >
                        <RotateCcw
                          className={`w-3 h-3 mr-1 ${reevaluatingId === selectedTask.id ? "animate-spin" : ""}`}
                        />
                        {reevaluatingId === selectedTask.id ? "重评中..." : "重新评估"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
                  {taskResults.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                      {selectedTask.status === "done"
                        ? "暂无结果"
                        : "任务尚未运行"}
                    </p>
                  ) : (
                    taskResults.map((r, i) => (
                      <div key={r.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">
                              #{i + 1}
                            </span>
                            <span className="text-sm text-slate-700 font-medium">
                              {r.question}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAnnotate(r, "correct")}
                              className={`p-1 rounded ${
                                r.humanJudgment === "correct"
                                  ? "bg-emerald-100"
                                  : "hover:bg-slate-100"
                              }`}
                              title="正确"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                            </button>
                            <button
                              onClick={() => handleAnnotate(r, "partial")}
                              className={`p-1 rounded ${
                                r.humanJudgment === "partial"
                                  ? "bg-amber-100"
                                  : "hover:bg-slate-100"
                              }`}
                              title="部分正确"
                            >
                              <Minus className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                            <button
                              onClick={() => handleAnnotate(r, "wrong")}
                              className={`p-1 rounded ${
                                r.humanJudgment === "wrong"
                                  ? "bg-red-100"
                                  : "hover:bg-slate-100"
                              }`}
                              title="错误"
                            >
                              <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>

                        {r.autoEvaluation && (
                          <div className="mb-3 p-3 bg-gradient-to-r from-violet-50/50 to-blue-50/50 rounded-lg border border-violet-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-violet-500" />
                                <span className="text-xs font-medium text-violet-700">
                                  智能评估
                                </span>
                                <span
                                  className={`badge text-[10px] px-2 py-0.5 border ${judgmentBadgeClass(
                                    r.autoEvaluation.suggestedJudgment,
                                  )}`}
                                >
                                  建议：
                                  {r.autoEvaluation.suggestedJudgment === "correct"
                                    ? "正确"
                                    : r.autoEvaluation.suggestedJudgment === "partial"
                                      ? "部分正确"
                                      : "错误"}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  置信度 {(r.autoEvaluation.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {!r.humanJudgment && (
                                  <button
                                    onClick={() => handleApplyAutoJudgment(r)}
                                    className="btn-success !py-0.5 !px-2 text-[10px]"
                                  >
                                    <Check className="w-3 h-3 mr-1" /> 应用判定
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    setExpandedResultId(
                                      expandedResultId === r.id ? null : r.id,
                                    )
                                  }
                                  className="p-1 hover:bg-white/60 rounded text-violet-500 text-[10px]"
                                >
                                  {expandedResultId === r.id ? "收起" : "详情"}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-2">
                              <ScoreBar
                                score={r.autoEvaluation.dimensions.semanticSimilarity}
                                label="语义相似度"
                                icon={Brain}
                                color="text-violet-600"
                              />
                              <ScoreBar
                                score={r.autoEvaluation.dimensions.keyInfoCoverage}
                                label="信息覆盖率"
                                icon={Target}
                                color="text-blue-600"
                              />
                              <ScoreBar
                                score={r.autoEvaluation.dimensions.factualAccuracy}
                                label="事实准确性"
                                icon={CheckCircle2}
                                color="text-emerald-600"
                              />
                              <ScoreBar
                                score={r.autoEvaluation.dimensions.formatNormativity}
                                label="格式规范性"
                                icon={ClipboardCheck}
                                color="text-amber-600"
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">
                                综合评分：
                                <span className="font-mono font-bold text-violet-600 ml-1">
                                  {(r.autoEvaluation.weightedScore * 100).toFixed(1)}%
                                </span>
                              </span>
                              {weights && (
                                <span className="text-slate-400">
                                  权重：语义{weights.semanticSimilarity} · 信息
                                  {weights.keyInfoCoverage} · 事实
                                  {weights.factualAccuracy} · 格式
                                  {weights.formatNormativity}
                                </span>
                              )}
                            </div>

                            {expandedResultId === r.id && (
                              <div className="mt-3 pt-3 border-t border-violet-200/50 space-y-2 text-[11px]">
                                {r.autoEvaluation.analysis.matchedKeywords.length > 0 && (
                                  <div>
                                    <span className="text-emerald-600 font-medium">
                                      匹配关键词：
                                    </span>
                                    <span className="text-slate-600 ml-1">
                                      {r.autoEvaluation.analysis.matchedKeywords
                                        .slice(0, 10)
                                        .join(", ")}
                                    </span>
                                  </div>
                                )}
                                {r.autoEvaluation.analysis.missingKeywords.length > 0 && (
                                  <div>
                                    <span className="text-amber-600 font-medium">
                                      缺失关键词：
                                    </span>
                                    <span className="text-slate-600 ml-1">
                                      {r.autoEvaluation.analysis.missingKeywords
                                        .slice(0, 10)
                                        .join(", ")}
                                    </span>
                                  </div>
                                )}
                                {r.autoEvaluation.analysis.factualErrors.length > 0 && (
                                  <div>
                                    <span className="text-red-600 font-medium">
                                      事实问题：
                                    </span>
                                    <div className="text-slate-600 ml-1 mt-1 space-y-0.5">
                                      {r.autoEvaluation.analysis.factualErrors.map(
                                        (err, idx) => (
                                          <div key={idx} className="flex items-start gap-1">
                                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
                                            <span>{err}</span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                                {r.autoEvaluation.analysis.formatIssues.length > 0 && (
                                  <div>
                                    <span className="text-blue-600 font-medium">
                                      格式建议：
                                    </span>
                                    <div className="text-slate-600 ml-1 mt-1 space-y-0.5">
                                      {r.autoEvaluation.analysis.formatIssues.map(
                                        (issue, idx) => (
                                          <div key={idx} className="flex items-start gap-1">
                                            <Zap className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-500" />
                                            <span>{issue}</span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-slate-400 mb-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> 标准答案
                            </div>
                            <div className="p-2 bg-slate-50 rounded text-slate-700">
                              {r.standardAnswer || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1 flex items-center gap-1">
                              {judgmentIcon(r.humanJudgment)} 模型回答
                              <span className="ml-auto font-mono">
                                {(r.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div
                              className={`p-2 rounded ${
                                r.humanJudgment === "correct"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : r.humanJudgment === "partial"
                                    ? "bg-amber-50 text-amber-800"
                                    : r.humanJudgment === "wrong"
                                      ? "bg-red-50 text-red-800"
                                      : "bg-primary-50/30 text-slate-700"
                              }`}
                            >
                              {r.answer}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showWeightsConfig && weights && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary-500" />
                <span className="font-medium text-slate-700">评估权重配置</span>
              </div>
              <button
                onClick={() => setShowWeightsConfig(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-5">
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700">
                    <Info className="w-3 h-3 inline mr-1" />
                    调整各评估维度的权重，权重越高该维度对最终评分的影响越大。权重之和建议为1.0。
                    当前权重之和：
                    <span className="font-mono font-bold ml-1">
                      {(
                        (tempWeights.semanticSimilarity ?? weights.semanticSimilarity) +
                        (tempWeights.keyInfoCoverage ?? weights.keyInfoCoverage) +
                        (tempWeights.factualAccuracy ?? weights.factualAccuracy) +
                        (tempWeights.formatNormativity ?? weights.formatNormativity)
                      ).toFixed(2)}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-3">
                    <Brain className="w-3.5 h-3.5 inline mr-1 text-violet-500" />
                    语义相似度权重
                    <span className="float-right font-mono text-violet-600">
                      {tempWeights.semanticSimilarity ?? weights.semanticSimilarity}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={tempWeights.semanticSimilarity ?? weights.semanticSimilarity}
                    onChange={(e) =>
                      setTempWeights({
                        ...tempWeights,
                        semanticSimilarity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    评估答案与标准答案在语义层面的相似程度，基于Jaccard相似度、编辑距离等计算
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-3">
                    <Target className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                    关键信息覆盖率权重
                    <span className="float-right font-mono text-blue-600">
                      {tempWeights.keyInfoCoverage ?? weights.keyInfoCoverage}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={tempWeights.keyInfoCoverage ?? weights.keyInfoCoverage}
                    onChange={(e) =>
                      setTempWeights({
                        ...tempWeights,
                        keyInfoCoverage: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    评估答案是否覆盖了标准答案中的关键信息点和关键词
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                    事实准确性权重
                    <span className="float-right font-mono text-emerald-600">
                      {tempWeights.factualAccuracy ?? weights.factualAccuracy}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={tempWeights.factualAccuracy ?? weights.factualAccuracy}
                    onChange={(e) =>
                      setTempWeights({
                        ...tempWeights,
                        factualAccuracy: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    评估答案是否存在事实性错误，如数字错误、矛盾表述等
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-3">
                    <ClipboardCheck className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                    格式规范性权重
                    <span className="float-right font-mono text-amber-600">
                      {tempWeights.formatNormativity ?? weights.formatNormativity}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={tempWeights.formatNormativity ?? weights.formatNormativity}
                    onChange={(e) =>
                      setTempWeights({
                        ...tempWeights,
                        formatNormativity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    评估答案的格式是否规范，包括标点符号、段落结构、列表格式等
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-3">判定阈值设置</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">
                        正确阈值
                        <span className="float-right font-mono text-emerald-600">
                          {((tempWeights.correctThreshold ?? weights.correctThreshold) * 100).toFixed(0)}%
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1"
                        step="0.05"
                        value={tempWeights.correctThreshold ?? weights.correctThreshold}
                        onChange={(e) =>
                          setTempWeights({
                            ...tempWeights,
                            correctThreshold: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">
                        部分正确阈值
                        <span className="float-right font-mono text-amber-600">
                          {((tempWeights.partialThreshold ?? weights.partialThreshold) * 100).toFixed(0)}%
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="0.6"
                        step="0.05"
                        value={tempWeights.partialThreshold ?? weights.partialThreshold}
                        onChange={(e) =>
                          setTempWeights({
                            ...tempWeights,
                            partialThreshold: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    综合评分 ≥ 正确阈值 判定为"正确"，介于两者之间判定为"部分正确"，低于部分正确阈值判定为"错误"
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex justify-between">
              <button onClick={handleResetWeights} className="btn-secondary">
                <RotateCcw className="w-3 h-3 mr-1" /> 重置默认
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowWeightsConfig(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button onClick={handleSaveWeights} className="btn-primary">
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
