import { useEffect, useState } from "react";
import {
  Upload,
  FileText,
  CopyCheck,
  Scissors,
  Database,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ImportProgress, ImportPhase } from "../../shared/types";

interface ImportProgressModalProps {
  taskId: string;
  onClose: () => void;
  onComplete?: (result: ImportProgress["result"]) => void;
  onCancel?: (rollback: boolean) => void;
}

const phases: { key: ImportPhase; label: string; icon: typeof Upload }[] = [
  { key: "parsing", label: "文件解析", icon: FileText },
  { key: "dedup", label: "去重检测", icon: CopyCheck },
  { key: "splitting", label: "文档切分", icon: Scissors },
  { key: "indexing", label: "索引构建", icon: Database },
];

export default function ImportProgressModal({
  taskId,
  onClose,
  onComplete,
  onCancel,
}: ImportProgressModalProps) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let stopped = false;

    const fetchProgress = async () => {
      try {
        const data = await api.knowledge.getImportProgress(taskId);
        setProgress(data);
        if (
          data.phase === "completed" ||
          data.phase === "cancelled" ||
          data.phase === "failed"
        ) {
          stopped = true;
          clearInterval(timer);
          if (data.phase === "completed" && onComplete && data.result) {
            onComplete(data.result);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    fetchProgress();
    timer = setInterval(fetchProgress, 500);

    return () => {
      if (!stopped) clearInterval(timer);
    };
  }, [taskId, onComplete]);

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = async (rollback: boolean) => {
    setCancelling(true);
    try {
      await api.knowledge.cancelImport(taskId, rollback);
      onCancel?.(rollback);
      setShowCancelConfirm(false);
    } catch (e) {
      // ignore
    } finally {
      setCancelling(false);
    }
  };

  if (!progress) return null;

  const currentPhaseIndex = phases.findIndex((p) => p.key === progress.phase);
  const isFinished =
    progress.phase === "completed" ||
    progress.phase === "cancelled" ||
    progress.phase === "failed";

  const getPhaseProgress = (): number => {
    switch (progress.phase) {
      case "parsing":
        return progress.totalFiles > 0
          ? (progress.processedFiles / progress.totalFiles) * 100
          : 0;
      case "dedup":
        return progress.totalDocuments > 0
          ? (progress.processedDocuments / progress.totalDocuments) * 100
          : 0;
      case "splitting":
        return progress.totalDocuments > 0
          ? (progress.processedDocuments / progress.totalDocuments) * 100
          : 0;
      case "indexing":
        return progress.totalChunks > 0
          ? (progress.processedChunks / progress.totalChunks) * 100
          : 0;
      default:
        return 100;
    }
  };

  const getOverallProgress = (): number => {
    if (isFinished) return 100;
    const phaseWeight = 100 / phases.length;
    const currentPhaseProgress = getPhaseProgress() / 100;
    return currentPhaseIndex * phaseWeight + phaseWeight * currentPhaseProgress;
  };

  const getStatusIcon = () => {
    if (progress.phase === "completed") return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
    if (progress.phase === "cancelled") return <XCircle className="w-6 h-6 text-slate-400" />;
    if (progress.phase === "failed") return <AlertTriangle className="w-6 h-6 text-red-500" />;
    return <Upload className="w-6 h-6 text-primary-600 animate-pulse" />;
  };

  const getStatusText = () => {
    if (progress.phase === "completed") return "导入完成";
    if (progress.phase === "cancelled") return "已取消";
    if (progress.phase === "failed") return "导入失败";
    return progress.message;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="card w-full max-w-lg mx-4 animate-slide-up overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">文档导入</h3>
            <p className="text-xs text-slate-500">{getStatusText()}</p>
          </div>
          {isFinished && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5">
          <div className="mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">总进度</span>
              <span className="font-mono text-slate-700">
                {Math.round(getOverallProgress())}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.phase === "failed"
                    ? "bg-red-500"
                    : progress.phase === "cancelled"
                    ? "bg-slate-400"
                    : "bg-gradient-to-r from-primary-500 to-primary-600"
                }`}
                style={{ width: `${getOverallProgress()}%` }}
              />
            </div>
          </div>

          <div className="space-y-3 mb-5">
            {phases.map((phase, i) => {
              const isActive = i === currentPhaseIndex && !isFinished;
              const isDone = i < currentPhaseIndex || progress.phase === "completed";
              const Icon = phase.icon;

              return (
                <div key={phase.key} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isActive
                        ? "bg-primary-100 text-primary-600"
                        : isDone
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          isActive
                            ? "text-primary-700"
                            : isDone
                            ? "text-slate-700"
                            : "text-slate-400"
                        }`}
                      >
                        {phase.label}
                      </span>
                      {isActive && !isFinished && (
                        <span className="text-xs text-slate-500 font-mono">
                          {Math.round(getPhaseProgress())}%
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all duration-300"
                          style={{ width: `${getPhaseProgress()}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {progress.currentFile && !isFinished && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">当前处理</div>
              <div className="text-sm text-slate-700 truncate font-mono">
                {progress.currentFile}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-lg font-semibold text-slate-700 font-mono">
                {progress.processedFiles}
                <span className="text-slate-400 text-sm">/{progress.totalFiles}</span>
              </div>
              <div className="text-xs text-slate-500">文件数</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-lg font-semibold text-slate-700 font-mono">
                {progress.processedDocuments}
                {progress.totalDocuments > 0 && (
                  <span className="text-slate-400 text-sm">/{progress.totalDocuments}</span>
                )}
              </div>
              <div className="text-xs text-slate-500">文档数</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-lg font-semibold text-slate-700 font-mono">
                {progress.processedChunks}
                {progress.totalChunks > 0 && (
                  <span className="text-slate-400 text-sm">/{progress.totalChunks}</span>
                )}
              </div>
              <div className="text-xs text-slate-500">片段数</div>
            </div>
          </div>

          {progress.result && progress.phase === "completed" && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">导入结果</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-emerald-700">{progress.result.success}</div>
                  <div className="text-emerald-600">成功</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-amber-700">{progress.result.duplicates}</div>
                  <div className="text-amber-600">重复</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-slate-600">{progress.result.skipped}</div>
                  <div className="text-slate-500">跳过</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-red-600">{progress.result.errors.length}</div>
                  <div className="text-red-500">错误</div>
                </div>
              </div>
            </div>
          )}

          {progress.error && progress.phase === "failed" && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-800">{progress.error}</span>
              </div>
            </div>
          )}
        </div>

        {!isFinished && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <XCircle className="w-4 h-4" />
              取消导入
            </button>
          </div>
        )}

        {isFinished && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
            <button onClick={onClose} className="btn-primary">
              关闭
            </button>
          </div>
        )}
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50">
          <div className="card w-full max-w-sm mx-4 animate-slide-up">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">确认取消导入？</h4>
                  <p className="text-xs text-slate-500">取消后可以选择保留或回滚已导入的数据</p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleConfirmCancel(true)}
                  disabled={cancelling}
                  className="w-full btn-secondary justify-start text-left"
                >
                  <div>
                    <div className="font-medium text-slate-700">回滚数据</div>
                    <div className="text-xs text-slate-400">删除已导入的所有内容，回到导入前状态</div>
                  </div>
                </button>
                <button
                  onClick={() => handleConfirmCancel(false)}
                  disabled={cancelling}
                  className="w-full btn-secondary justify-start text-left"
                >
                  <div>
                    <div className="font-medium text-slate-700">保留已导入部分</div>
                    <div className="text-xs text-slate-400">保留当前已成功导入的文档和版本</div>
                  </div>
                </button>
              </div>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="w-full btn-secondary mt-3"
              >
                继续导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
