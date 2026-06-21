import { useEffect, useState } from "react";
import {
  ScrollText,
  Download,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Database,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import type {
  LogEntry,
  LogLevel,
  LogCategory,
  ConsistencyReport,
} from "../../shared/types";

export default function Logs() {
  const { showToast } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [checking, setChecking] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.logs.list({
        level: level === "all" ? undefined : level,
        category: category === "all" ? undefined : category,
      });
      setLogs(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [level, category]);

  const handleConsistencyCheck = async () => {
    setChecking(true);
    try {
      const data = await api.logs.consistencyCheck();
      setReport(data);
      showToast(
        data.summary.failed === 0 ? "一致性校验通过" : `发现 ${data.summary.failed} 个问题`,
        data.summary.failed === 0 ? "success" : "warn",
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "校验失败", "error");
    } finally {
      setChecking(false);
    }
  };

  const handleExport = () => {
    const params: { level?: string; category?: string } = {};
    if (level !== "all") params.level = level;
    if (category !== "all") params.category = category;
    const url = api.logs.exportUrl(params);
    window.open(url, "_blank");
    showToast("已导出日志", "success");
  };

  const levelIcon = (l: LogLevel) => {
    if (l === "error")
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    if (l === "warn")
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    return <Info className="w-3.5 h-3.5 text-blue-500" />;
  };

  const levelBg = (l: LogLevel) => {
    if (l === "error") return "bg-red-50 border-l-4 border-red-400";
    if (l === "warn") return "bg-amber-50 border-l-4 border-amber-400";
    return "bg-blue-50/50 border-l-4 border-blue-300";
  };

  const categoryBadge = (c: LogCategory) => {
    const map: Record<LogCategory, string> = {
      import: "导入",
      index: "索引",
      qa: "问答",
      evaluation: "评测",
      system: "系统",
    };
    const colorMap: Record<LogCategory, string> = {
      import: "bg-purple-50 text-purple-700",
      index: "bg-cyan-50 text-cyan-700",
      qa: "bg-green-50 text-green-700",
      evaluation: "bg-orange-50 text-orange-700",
      system: "bg-slate-100 text-slate-600",
    };
    return (
      <span className={`badge ${colorMap[c]} !py-0.5 !px-1.5 text-[10px]`}>
        {map[c]}
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="系统日志"
        description="查看系统操作日志、异常信息和数据一致性校验"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleConsistencyCheck}
              disabled={checking}
              className="btn-secondary"
            >
              {checking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> 校验中...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> 一致性校验
                </>
              )}
            </button>
            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" /> 导出日志
            </button>
          </div>
        }
      />

      {report && (
        <div
          className={`card p-5 mb-6 animate-slide-up ${
            report.summary.failed === 0
              ? "border border-emerald-200 bg-emerald-50/30"
              : "border border-amber-200 bg-amber-50/30"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Database
              className={`w-4 h-4 ${report.summary.failed === 0 ? "text-emerald-600" : "text-amber-600"}`}
            />
            <span className="font-medium text-slate-700">
              一致性校验报告
            </span>
            <span className="ml-auto text-xs text-slate-400 font-mono">
              {new Date(report.timestamp).toLocaleString("zh-CN")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-white/60 rounded-lg">
              <div className="text-2xl font-serif font-bold text-slate-700">
                {report.summary.totalChecks}
              </div>
              <div className="text-xs text-slate-400">总检查项</div>
            </div>
            <div className="text-center p-3 bg-white/60 rounded-lg">
              <div className="text-2xl font-serif font-bold text-emerald-600">
                {report.summary.passed}
              </div>
              <div className="text-xs text-slate-400">通过</div>
            </div>
            <div className="text-center p-3 bg-white/60 rounded-lg">
              <div
                className={`text-2xl font-serif font-bold ${
                  report.summary.failed === 0 ? "text-slate-400" : "text-red-500"
                }`}
              >
                {report.summary.failed}
              </div>
              <div className="text-xs text-slate-400">问题</div>
            </div>
          </div>
          {report.issues.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {report.issues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 bg-white rounded-lg border border-slate-100"
                >
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-xs">
                    <div className="font-medium text-slate-700 mb-0.5">
                      {issue.description}
                    </div>
                    {issue.affectedIds.length > 0 && (
                      <div className="text-slate-400 font-mono mt-0.5">
                        影响: {issue.affectedIds.slice(0, 5).join(", ")}
                        {issue.affectedIds.length > 5 ?
                          ` 等 ${issue.affectedIds.length} 个` : ""}
                      </div>
                    )}
                    {issue.fix && (
                      <div className="text-emerald-600 mt-1">
                        建议: {issue.fix}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {report.issues.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              所有数据引用完整，知识库版本、评测结果、人工修订和日志完全对得上
            </div>
          )}
        </div>
      )}

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">级别:</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="input py-1.5 text-sm !w-auto"
            >
              <option value="all">全部</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">类别:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input py-1.5 text-sm !w-auto"
            >
              <option value="all">全部</option>
              <option value="import">导入</option>
              <option value="index">索引</option>
              <option value="qa">问答</option>
              <option value="evaluation">评测</option>
              <option value="system">系统</option>
            </select>
          </div>
          <button
            onClick={loadLogs}
            className="btn-secondary !py-1.5 ml-auto"
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />{" "}
            刷新
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-sm text-slate-700">日志记录</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            共 {logs.length} 条
          </span>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>暂无日志记录</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 ${levelBg(log.level)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{levelIcon(log.level)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {categoryBadge(log.category)}
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString("zh-CN")}
                        </span>
                        {log.recoverable !== undefined && (
                          <span
                            className={`badge !py-0.5 !px-1.5 text-[10px] ${
                              log.recoverable
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {log.recoverable ? "可恢复" : "不可恢复"}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700 mb-1">
                        {log.message}
                      </div>
                      {log.affectedScope && (
                        <div className="text-xs text-slate-500 font-mono">
                          影响范围: {log.affectedScope}
                        </div>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="mt-2 text-[10px] font-mono text-slate-500 bg-white/60 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
