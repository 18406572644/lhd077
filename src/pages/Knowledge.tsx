import { useEffect, useRef, useState, useMemo } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileJson,
  Trash2,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Tag as TagIcon,
  Edit2,
  Filter,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import VersionSelector from "@/components/VersionSelector";
import ParamsPanel from "@/components/ParamsPanel";
import ImportProgressModal from "@/components/ImportProgressModal";
import TagSelector from "@/components/TagSelector";
import TagBadge from "@/components/TagBadge";
import type { KnowledgeDocument, ImportResult, Tag } from "../../shared/types";

const MAX_QUESTION_LENGTH = 2000;

export default function Knowledge() {
  const { versions, selectedVersionId, retrievalParams, setVersions, showToast } =
    useAppStore();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [indexStatus, setIndexStatus] = useState<{
    status: string;
    checksumValid: boolean;
    totalChunks: number;
    builtAt?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTaskId, setImportTaskId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [matchAllTags, setMatchAllTags] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingTagIds, setEditingTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  useEffect(() => {
    api.knowledge.listVersions().then(setVersions);
    loadAllTags();
  }, [setVersions]);

  const loadAllTags = async () => {
    try {
      const tags = await api.tags.list();
      setAllTags(tags);
    } catch (e) {
      console.error("加载标签失败:", e);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (filterTagIds.length === 0) return documents;
    
    return documents.filter((doc) => {
      const docTagIds = doc.tagIds || [];
      if (matchAllTags) {
        return filterTagIds.every((tid) => docTagIds.includes(tid));
      } else {
        return filterTagIds.some((tid) => docTagIds.includes(tid));
      }
    });
  }, [documents, filterTagIds, matchAllTags]);

  const getTagById = (id: string): Tag | undefined => {
    return allTags.find((t) => t.id === id);
  };

  useEffect(() => {
    if (selectedVersionId) {
      api.knowledge.listDocuments(selectedVersionId).then(setDocuments);
      api.knowledge.getIndexStatus(selectedVersionId).then(setIndexStatus);
    } else {
      setDocuments([]);
      setIndexStatus(null);
    }
  }, [selectedVersionId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const result = await api.knowledge.importAsync(
        Array.from(files),
        versionName || undefined,
        retrievalParams,
      );
      setImportTaskId(result.taskId);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setVersionName("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "导入启动失败", "error");
    }
  };

  const handleImportComplete = async (result: ImportResult | undefined) => {
    if (result) {
      showToast(
        `导入完成：成功${result.success}条，重复${result.duplicates}条，跳过${result.skipped}条，错误${result.errors.length}条`,
        result.errors.length > 0 ? "error" : "success",
      );
      await api.knowledge.listVersions().then(setVersions);
      if (result.versionId) {
        api.knowledge.getIndexStatus(result.versionId).then(setIndexStatus);
        api.knowledge.listDocuments(result.versionId).then(setDocuments);
      }
    }
    setImportTaskId(null);
  };

  const handleImportCancel = async (rollback: boolean) => {
    showToast(
      rollback ? "导入已取消，数据已回滚" : "导入已取消，部分数据已保留",
      "warn",
    );
    await api.knowledge.listVersions().then(setVersions);
    setImportTaskId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该文档？相关切分片段也会被移除。")) return;
    try {
      await api.knowledge.deleteDocument(id);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      showToast("文档已删除", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "删除失败", "error");
    }
  };

  const handleRebuildIndex = async () => {
    if (!selectedVersionId) return;
    setLoading(true);
    try {
      await api.knowledge.rebuildIndex(selectedVersionId);
      const st = await api.knowledge.getIndexStatus(selectedVersionId);
      setIndexStatus(st);
      showToast("索引重建成功", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "重建失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const openTagEditor = async (doc: KnowledgeDocument) => {
    setEditingDocId(doc.id);
    setEditingTagIds(doc.tagIds || []);
    setShowTagEditor(true);
  };

  const handleSaveTags = async () => {
    if (!editingDocId) return;
    setSavingTags(true);
    try {
      await api.tags.setEntityTags("document", editingDocId, editingTagIds);
      setDocuments((docs) =>
        docs.map((d) =>
          d.id === editingDocId ? { ...d, tagIds: editingTagIds } : d
        )
      );
      showToast("标签保存成功", "success");
      setShowTagEditor(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSavingTags(false);
    }
  };

  const sourceBadge = (s: string) => {
    if (s === "markdown")
      return (
        <span className="badge bg-blue-50 text-blue-700">
          <FileText className="w-3 h-3 mr-1" /> Markdown
        </span>
      );
    if (s === "faq")
      return (
        <span className="badge bg-amber-50 text-amber-700">
          <FileSpreadsheet className="w-3 h-3 mr-1" /> FAQ
        </span>
      );
    return (
      <span className="badge bg-purple-50 text-purple-700">
        <FileJson className="w-3 h-3 mr-1" /> 历史问答
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="知识库管理"
        description="导入知识源（Markdown、FAQ表格、历史问答），管理文档与索引版本"
        actions={
          <div className="flex items-center gap-2">
            <VersionSelector />
            <button
              onClick={handleRebuildIndex}
              disabled={!selectedVersionId || loading}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              重建索引
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div
            className={`card p-6 border-2 border-dashed transition-all ${
              dragging
                ? "border-primary-500 bg-primary-50"
                : "border-slate-200 hover:border-primary-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-50 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                拖拽文件到此处或
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary-600 hover:underline ml-1"
                >
                  点击选择
                </button>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                支持 .md / .markdown / .csv / .tsv / .json，最大 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.csv,.tsv,.json,.txt"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs text-slate-500 mb-1">
                版本名称（可选）
              </label>
              <input
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="留空将自动生成"
                className="input py-1.5 text-sm"
                maxLength={MAX_QUESTION_LENGTH}
              />
            </div>
            {importTaskId && (
              <div className="mt-4 text-center text-sm text-primary-600">
                <RefreshCw className="w-4 h-4 inline mr-1 animate-spin" />
                导入进行中...
              </div>
            )}
          </div>

          <ParamsPanel />

          {indexStatus && selectedVersionId && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-sm text-slate-700">索引状态</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">状态</span>
                  <span>
                    {indexStatus.status === "ready" ? (
                      <span className="badge bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> 正常
                      </span>
                    ) : indexStatus.status === "building" ? (
                      <span className="badge bg-blue-50 text-blue-700">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 构建中
                      </span>
                    ) : (
                      <span className="badge bg-red-50 text-red-700">
                        <XCircle className="w-3 h-3 mr-1" /> 损坏
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">校验通过</span>
                  <span>
                    {indexStatus.checksumValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 inline" />
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">片段总数</span>
                  <span className="font-mono">{indexStatus.totalChunks}</span>
                </div>
                {indexStatus.builtAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">构建时间</span>
                    <span className="font-mono text-xs">
                      {new Date(indexStatus.builtAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Copy className="w-4 h-4 text-primary-600" />
              <span className="font-medium text-sm text-slate-700">知识库版本</span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {versions.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">暂无版本</p>
              )}
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`p-2 rounded-md text-xs cursor-pointer transition-colors ${
                    v.id === selectedVersionId
                      ? "bg-primary-50 border border-primary-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium text-slate-700 truncate">{v.name}</div>
                  <div className="text-slate-400 font-mono mt-0.5">
                    {v.documentIds.length} 篇 ·{" "}
                    {new Date(v.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-slate-700">
                  文档列表（{filteredDocuments.length}/{documents.length}）
                </span>
                {filterTagIds.length > 0 && (
                  <button
                    onClick={() => setFilterTagIds([])}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    清除筛选
                  </button>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">按标签筛选</span>
                  </div>
                  <TagSelector
                    selectedTagIds={filterTagIds}
                    onChange={setFilterTagIds}
                    placeholder="选择标签进行筛选"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={matchAllTags}
                      onChange={(e) => setMatchAllTags(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    同时满足所有标签
                  </label>
                </div>
              </div>
            </div>
            {documents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>请先选择知识库版本或导入新文档</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Filter className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>没有符合筛选条件的文档</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="table-th">标题</th>
                      <th className="table-th">来源</th>
                      <th className="table-th">标签</th>
                      <th className="table-th">切分数</th>
                      <th className="table-th">创建时间</th>
                      <th className="table-th"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocuments.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <span className="max-w-xs truncate">{d.title}</span>
                            {d.isDuplicate && (
                              <span className="badge bg-amber-50 text-amber-700">
                                重复
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-td">{sourceBadge(d.source)}</td>
                        <td className="table-td">
                          <div className="flex flex-wrap gap-1">
                            {(d.tagIds || []).slice(0, 3).map((tagId) => {
                              const tag = getTagById(tagId);
                              return tag ? (
                                <TagBadge key={tagId} tag={tag} size="sm" />
                              ) : null;
                            })}
                            {(d.tagIds || []).length > 3 && (
                              <span className="text-xs text-slate-400">
                                +{(d.tagIds || []).length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-td font-mono">{d.chunkCount}</td>
                        <td className="table-td text-slate-400 font-mono text-xs">
                          {new Date(d.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openTagEditor(d)}
                              className="p-1.5 rounded hover:bg-primary-50 text-slate-400 hover:text-primary-500 transition-colors"
                              title="编辑标签"
                            >
                              <TagIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(d.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {importTaskId && (
        <ImportProgressModal
          taskId={importTaskId}
          onClose={() => setImportTaskId(null)}
          onComplete={handleImportComplete}
          onCancel={handleImportCancel}
        />
      )}

      {showTagEditor && editingDocId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                <TagIcon className="w-5 h-5 inline mr-2 text-primary-600" />
                编辑文档标签
              </h3>
              <button
                onClick={() => setShowTagEditor(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-600">
                  文档：
                  <span className="font-medium text-slate-800">
                    {documents.find((d) => d.id === editingDocId)?.title}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  选择标签
                </label>
                <TagSelector
                  selectedTagIds={editingTagIds}
                  onChange={setEditingTagIds}
                  placeholder="选择要关联的标签"
                />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">已选标签：</p>
                <div className="flex flex-wrap gap-1.5">
                  {editingTagIds.length === 0 ? (
                    <span className="text-xs text-slate-400">暂无标签</span>
                  ) : (
                    editingTagIds.map((tagId) => {
                      const tag = getTagById(tagId);
                      return tag ? (
                        <TagBadge
                          key={tagId}
                          tag={tag}
                          size="sm"
                          onRemove={() =>
                            setEditingTagIds((ids) =>
                              ids.filter((id) => id !== tagId)
                            )
                          }
                        />
                      ) : null;
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTagEditor(false)}
                disabled={savingTags}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveTags}
                disabled={savingTags}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingTags ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
