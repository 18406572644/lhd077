import { useCallback, useEffect, useRef, useState } from "react";
import {
  DatabaseBackup,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Play,
  Clock,
  HardDrive,
  FileArchive,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import type { BackupInfo, BackupListResult } from "../../shared/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Settings() {
  const { showToast } = useAppStore();
  const [backupData, setBackupData] = useState<BackupListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.backup.list();
      setBackupData(result);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载备份列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleFullBackup = async () => {
    try {
      setCreatingBackup(true);
      const result = await api.backup.createFull();
      if (result.success) {
        showToast("全量备份创建成功", "success");
        loadBackups();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "创建全量备份失败", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleIncrementalBackup = async () => {
    try {
      setCreatingBackup(true);
      const result = await api.backup.createIncremental();
      if (result.success) {
        showToast("增量备份创建成功", "success");
        loadBackups();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "创建增量备份失败", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreClick = (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedBackup) return;
    try {
      setRestoringId(selectedBackup.id);
      const result = await api.backup.restore(selectedBackup.id);
      if (result.success) {
        showToast(
          `恢复成功！回滚备份ID: ${result.rollbackBackupId?.slice(0, 12)}...`,
          "success"
        );
        loadBackups();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "恢复备份失败", "error");
    } finally {
      setRestoringId(null);
      setShowRestoreConfirm(false);
      setSelectedBackup(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这个备份吗？此操作不可恢复。")) return;
    try {
      await api.backup.remove(id);
      showToast("备份已删除", "success");
      loadBackups();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "删除备份失败", "error");
    }
  };

  const handleDownload = (backup: BackupInfo) => {
    const url = api.backup.downloadUrl(backup.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${backup.name}.zip`;
    a.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await api.backup.importFile(file);
      if (result.success) {
        showToast("备份导入成功", "success");
        loadBackups();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "导入备份失败", "error");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getBackupTypeBadge = (type: string) => {
    if (type === "full") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700">
          <FileArchive className="w-3 h-3" />
          全量
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
        <ArrowUpDown className="w-3 h-3" />
        增量
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="数据备份与恢复管理，保护您的知识库数据安全"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              导入备份
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <DatabaseBackup className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">数据备份</h2>
            <p className="text-sm text-slate-500">
              将所有数据（文档、索引、评测、日志）打包备份
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Clock className="w-4 h-4" />
              上次备份
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {backupData?.lastBackupAt
                ? formatDate(backupData.lastBackupAt)
                : "暂无备份"}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <FileArchive className="w-4 h-4" />
              备份数量
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {backupData?.backups.length ?? 0} 个
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <HardDrive className="w-4 h-4" />
              占用空间
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {backupData ? formatSize(backupData.totalSize) : "0 B"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleFullBackup}
            disabled={creatingBackup}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {creatingBackup ? "备份中..." : "一键全量备份"}
          </button>
          <button
            onClick={handleIncrementalBackup}
            disabled={creatingBackup}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            {creatingBackup ? "备份中..." : "增量备份"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">备份列表</h2>
              <p className="text-sm text-slate-500">
                选择备份文件进行恢复或下载
              </p>
            </div>
          </div>
          <button
            onClick={loadBackups}
            disabled={loading}
            className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            刷新
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">加载中...</div>
        ) : backupData?.backups.length === 0 ? (
          <div className="py-12 text-center">
            <DatabaseBackup className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">暂无备份记录</p>
            <p className="text-sm text-slate-400 mt-1">
              点击上方按钮创建您的第一个备份
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backupData?.backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                    <FileArchive className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">
                        {backup.name}
                      </span>
                      {getBackupTypeBadge(backup.type)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>{formatDate(backup.createdAt)}</span>
                      <span>{formatSize(backup.size)}</span>
                      <span>{backup.dataFiles.length} 个文件</span>
                    </div>
                    {backup.description && (
                      <p className="text-xs text-slate-400 mt-1">
                        {backup.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(backup)}
                    className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                    title="下载备份"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRestoreClick(backup)}
                    disabled={restoringId === backup.id}
                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md disabled:opacity-50 transition-colors"
                    title="恢复到此备份"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(backup.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="删除备份"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRestoreConfirm && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    确认恢复备份
                  </h3>
                  <p className="text-sm text-slate-500">
                    恢复操作将覆盖当前所有数据
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">备份名称</span>
                    <span className="font-medium">{selectedBackup.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">备份类型</span>
                    <span>
                      {selectedBackup.type === "full" ? "全量备份" : "增量备份"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">创建时间</span>
                    <span>{formatDate(selectedBackup.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-primary-50 rounded-lg text-sm">
                <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <p className="text-primary-700">
                  恢复前将自动创建当前数据的回滚备份，如有问题可随时恢复。
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setSelectedBackup(null);
                }}
                disabled={restoringId === selectedBackup.id}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRestoreConfirm}
                disabled={restoringId === selectedBackup.id}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {restoringId === selectedBackup.id ? "恢复中..." : "确认恢复"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
