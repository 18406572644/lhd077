import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  XCircle,
  Calculator,
  Code2,
  ArrowUp,
  ArrowDown,
  Play,
  CheckCircle2,
  AlertCircle,
  Settings,
  Gauge,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import type {
  Metric,
  BuiltInMetric,
  MetricComputeType,
} from "../../shared/types";

const builtInOptions: { value: BuiltInMetric; label: string; desc: string }[] = [
  { value: "accuracy", label: "准确率", desc: "完全正确的答案占比" },
  { value: "partialRate", label: "部分正确率", desc: "部分正确的答案占比" },
  { value: "wrongRate", label: "错误率", desc: "完全错误的答案占比" },
  { value: "avgConfidence", label: "平均置信度", desc: "所有答案的平均置信度" },
];

const defaultCustomScript = `// 自定义计算脚本
// 入参: results - QAResult[] 数组
// 返回: number 类型的指标值
// 可用属性: r.question, r.answer, r.standardAnswer, r.confidence, r.humanJudgment

const correct = results.filter(r => r.humanJudgment === 'correct').length;
const total = results.length;
return total > 0 ? correct / total : 0;`;

export default function Metrics() {
  const { showToast } = useAppStore();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingScript, setTestingScript] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    value?: number;
    error?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    computeType: "built-in" as MetricComputeType,
    builtInType: "accuracy" as BuiltInMetric,
    customScript: defaultCustomScript,
    weight: 1,
    higherIsBetter: true,
  });

  const loadMetrics = useCallback(async () => {
    try {
      const list = await api.metrics.list();
      setMetrics(list);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载失败", "error");
    }
  }, [showToast]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleOpenCreate = () => {
    setEditingMetric(null);
    setFormData({
      name: "",
      description: "",
      computeType: "built-in",
      builtInType: "accuracy",
      customScript: defaultCustomScript,
      weight: 1,
      higherIsBetter: true,
    });
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (metric: Metric) => {
    setEditingMetric(metric);
    setFormData({
      name: metric.name,
      description: metric.description,
      computeType: metric.computeType,
      builtInType: metric.builtInType || "accuracy",
      customScript: metric.customScript || defaultCustomScript,
      weight: metric.weight,
      higherIsBetter: metric.higherIsBetter,
    });
    setTestResult(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("请输入指标名称", "error");
      return;
    }
    if (formData.computeType === "custom" && !formData.customScript.trim()) {
      showToast("请输入自定义脚本", "error");
      return;
    }
    if (formData.weight < 0) {
      showToast("权重不能为负数", "error");
      return;
    }

    setLoading(true);
    try {
      if (editingMetric) {
        await api.metrics.update(editingMetric.id, formData);
        showToast("指标已更新", "success");
      } else {
        await api.metrics.create(formData);
        showToast("指标已创建", "success");
      }
      setShowModal(false);
      loadMetrics();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个指标吗？")) return;
    try {
      await api.metrics.remove(id);
      showToast("指标已删除", "success");
      loadMetrics();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "删除失败", "error");
    }
  };

  const handleTestScript = async () => {
    if (!formData.customScript.trim()) {
      showToast("请输入脚本内容", "error");
      return;
    }
    setTestingScript(true);
    setTestResult(null);
    try {
      const result = await api.metrics.testScript(formData.customScript);
      setTestResult(result);
    } catch (e) {
      setTestResult({
        success: false,
        error: e instanceof Error ? e.message : "测试失败",
      });
    } finally {
      setTestingScript(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="指标管理"
        description="管理自定义评测指标，支持内置公式和自定义脚本"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> 新建指标
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.length === 0 && (
          <div className="col-span-full card p-12 text-center text-slate-400">
            <Gauge className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">暂无自定义指标</p>
            <p className="text-xs mt-1">点击右上角"新建指标"开始创建</p>
          </div>
        )}
        {metrics.map((m) => (
          <div key={m.id} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {m.computeType === "built-in" ? (
                  <Calculator className="w-4 h-4 text-primary-500" />
                ) : (
                  <Code2 className="w-4 h-4 text-amber-500" />
                )}
                <span className="font-medium text-slate-700">{m.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(m)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3 line-clamp-2">
              {m.description || "暂无描述"}
            </p>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="badge bg-slate-100 text-slate-600">
                  权重: {m.weight}
                </span>
                <span
                  className={`badge ${
                    m.higherIsBetter
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {m.higherIsBetter ? (
                    <ArrowUp className="w-3 h-3 mr-0.5 inline" />
                  ) : (
                    <ArrowDown className="w-3 h-3 mr-0.5 inline" />
                  )}
                  {m.higherIsBetter ? "越高越好" : "越低越好"}
                </span>
              </div>
              <span className="text-slate-400">
                {m.computeType === "built-in" ? "内置公式" : "自定义脚本"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary-500" />
                <span className="font-medium text-slate-700">
                  {editingMetric ? "编辑指标" : "新建指标"}
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    指标名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="例如：综合准确率"
                    className="input py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    指标描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="描述这个指标的用途和计算方式"
                    rows={2}
                    className="input py-1.5 text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      计算方式
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setFormData({
                            ...formData,
                            computeType: "built-in",
                          })
                        }
                        className={`flex-1 py-1.5 text-xs rounded-md border ${
                          formData.computeType === "built-in"
                            ? "bg-primary-50 border-primary-300 text-primary-700"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Calculator className="w-3.5 h-3.5 inline mr-1" />
                        内置公式
                      </button>
                      <button
                        onClick={() =>
                          setFormData({
                            ...formData,
                            computeType: "custom",
                          })
                        }
                        className={`flex-1 py-1.5 text-xs rounded-md border ${
                          formData.computeType === "custom"
                            ? "bg-amber-50 border-amber-300 text-amber-700"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5 inline mr-1" />
                        自定义脚本
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      权重
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          weight: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="input py-1.5 text-sm"
                    />
                  </div>
                </div>

                {formData.computeType === "built-in" && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-2">
                      选择内置指标
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {builtInOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              builtInType: opt.value,
                            })
                          }
                          className={`p-3 text-left rounded-lg border transition-all ${
                            formData.builtInType === opt.value
                              ? "border-primary-400 bg-primary-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-700">
                            {opt.label}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {opt.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {formData.computeType === "custom" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-slate-500">
                        自定义脚本
                      </label>
                      <button
                        onClick={handleTestScript}
                        disabled={testingScript}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        {testingScript ? "测试中..." : "测试脚本"}
                      </button>
                    </div>
                    <textarea
                      value={formData.customScript}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customScript: e.target.value,
                        })
                      }
                      rows={12}
                      className="input font-mono text-xs resize-none"
                      placeholder="输入 JavaScript 脚本，返回数字类型的指标值"
                    />
                    {testResult && (
                      <div
                        className={`mt-2 p-2 rounded text-xs flex items-center gap-2 ${
                          testResult.success
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {testResult.success ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              测试通过，返回值:{" "}
                              <span className="font-mono font-bold">
                                {testResult.value?.toFixed(4)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{testResult.error}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-500 mb-2">
                    指标方向
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setFormData({ ...formData, higherIsBetter: true })
                      }
                      className={`flex-1 py-2 text-sm rounded-md border ${
                        formData.higherIsBetter
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <ArrowUp className="w-4 h-4 inline mr-1" />
                      越高越好
                    </button>
                    <button
                      onClick={() =>
                        setFormData({ ...formData, higherIsBetter: false })
                      }
                      className={`flex-1 py-2 text-sm rounded-md border ${
                        !formData.higherIsBetter
                          ? "bg-red-50 border-red-300 text-red-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <ArrowDown className="w-4 h-4 inline mr-1" />
                      越低越好
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
