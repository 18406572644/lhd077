import { useEffect, useState, useMemo } from "react";
import {
  Send,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
  FileEdit,
  BookMarked,
  AlertTriangle,
  History,
  Tag as TagIcon,
  Filter,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import VersionSelector from "@/components/VersionSelector";
import ParamsPanel from "@/components/ParamsPanel";
import TagSelector from "@/components/TagSelector";
import TagBadge from "@/components/TagBadge";
import type { QAResult, HumanJudgment, Tag } from "../../shared/types";

const MAX_QUESTION_LENGTH = 2000;

export default function QATest() {
  const { versions, selectedVersionId, retrievalParams, setVersions, showToast } =
    useAppStore();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<QAResult | null>(null);
  const [history, setHistory] = useState<QAResult[]>([]);
  const [standardAnswer, setStandardAnswer] = useState("");
  const [humanNote, setHumanNote] = useState("");
  const [questionWarning, setQuestionWarning] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [matchAllTags, setMatchAllTags] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
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

  const getTagById = (id: string): Tag | undefined => {
    return allTags.find((t) => t.id === id);
  };

  const filteredHistory = useMemo(() => {
    if (filterTagIds.length === 0) return history;
    
    return history.filter((r) => {
      const tagIds = r.tagIds || [];
      if (matchAllTags) {
        return filterTagIds.every((tid) => tagIds.includes(tid));
      } else {
        return filterTagIds.some((tid) => tagIds.includes(tid));
      }
    });
  }, [history, filterTagIds, matchAllTags]);

  useEffect(() => {
    if (question.length > MAX_QUESTION_LENGTH) {
      setQuestionWarning(`问题超长（${question.length}/${MAX_QUESTION_LENGTH}），将被截断`);
    } else if (questionWarning) {
      setQuestionWarning(null);
    }
  }, [question, questionWarning]);

  const handleAsk = async () => {
    if (!selectedVersionId) {
      showToast("请先选择知识库版本", "error");
      return;
    }
    if (!question.trim()) {
      showToast("问题不能为空", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await api.qa.ask({
        question,
        versionId: selectedVersionId,
        retrievalParams,
      });
      setCurrentResult(result);
      setStandardAnswer(result.standardAnswer || "");
      setHistory((h) => [result, ...h].slice(0, 50));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "问答失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotate = async (judgment: HumanJudgment) => {
    if (!currentResult) return;
    try {
      const updated = await api.qa.annotate({
        resultId: currentResult.id,
        judgment,
        note: humanNote || undefined,
        standardAnswer: standardAnswer || undefined,
      });
      setCurrentResult(updated);
      setHistory((h) => h.map((r) => (r.id === updated.id ? updated : r)));
      showToast("判定已保存", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  const openTagEditor = () => {
    if (!currentResult) return;
    setEditingTagIds(currentResult.tagIds || []);
    setShowTagEditor(true);
  };

  const handleSaveTags = async () => {
    if (!currentResult) return;
    setSavingTags(true);
    try {
      const result = await api.tags.setEntityTags(
        "qa",
        currentResult.id,
        editingTagIds
      );
      const updated = { ...currentResult, tagIds: result.tagIds };
      setCurrentResult(updated);
      setHistory((h) =>
        h.map((r) => (r.id === currentResult.id ? updated : r))
      );
      showToast("标签保存成功", "success");
      setShowTagEditor(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSavingTags(false);
    }
  };

  const judgmentBadge = (j?: HumanJudgment) => {
    if (j === "correct")
      return (
        <span className="badge bg-emerald-50 text-emerald-700">
          <ThumbsUp className="w-3 h-3 mr-1" /> 正确
        </span>
      );
    if (j === "partial")
      return (
        <span className="badge bg-amber-50 text-amber-700">
          <Minus className="w-3 h-3 mr-1" /> 部分正确
        </span>
      );
    if (j === "wrong")
      return (
        <span className="badge bg-red-50 text-red-700">
          <ThumbsDown className="w-3 h-3 mr-1" /> 错误
        </span>
      );
    return <span className="badge bg-slate-100 text-slate-500">未判定</span>;
  };

  return (
    <div>
      <PageHeader
        title="问答测试台"
        description="单条问答测试，检索片段展示，人工修订标准答案与判定"
        actions={<VersionSelector />}
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              你的问题
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="请输入你想测试的问题..."
              rows={4}
              className="input resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk();
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={
                    question.length > MAX_QUESTION_LENGTH
                      ? "text-red-500"
                      : "text-slate-400"
                  }
                >
                  {question.length}/{MAX_QUESTION_LENGTH}
                </span>
                {questionWarning && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {questionWarning}
                  </span>
                )}
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">Ctrl+Enter 发送</span>
              </div>
              <button
                onClick={handleAsk}
                disabled={loading || !selectedVersionId}
                className="btn-primary"
              >
                {loading ? (
                  <Sparkles className="w-4 h-4 animate-pulse" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {loading ? "生成中..." : "提问"}
              </button>
            </div>
          </div>

          {currentResult && (
            <div className="card overflow-hidden animate-slide-up">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-accent-500" />
                  <span className="font-medium text-sm text-slate-700">回答结果</span>
                  {judgmentBadge(currentResult.humanJudgment)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openTagEditor}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    title="编辑标签"
                  >
                    <TagIcon className="w-3.5 h-3.5" />
                    标签
                  </button>
                  <span className="text-xs text-slate-400">置信度</span>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all"
                      style={{ width: `${currentResult.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-600">
                    {(currentResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <div className="text-xs text-slate-400 mb-1.5">问题</div>
                  <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md">
                    {currentResult.question}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> 模型回答
                  </div>
                  <div className="text-sm text-slate-800 bg-primary-50/30 p-4 rounded-md border border-primary-100 leading-relaxed whitespace-pre-wrap">
                    {currentResult.answer}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                    <BookMarked className="w-3 h-3" /> 检索片段（
                    {currentResult.retrievedChunks.length}）
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {currentResult.retrievedChunks.map((c, i) => (
                      <div
                        key={c.chunkId}
                        className="p-3 rounded-md bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-primary-600">
                            #{i + 1} · {c.documentTitle}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            score: {(c.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {c.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <FileEdit className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-sm text-slate-700">
                    人工修订与判定
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      标准答案（可选，用于修订）
                    </label>
                    <textarea
                      value={standardAnswer}
                      onChange={(e) => setStandardAnswer(e.target.value)}
                      rows={2}
                      placeholder="填写或修订标准答案..."
                      className="input text-sm py-1.5 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      备注（可选）
                    </label>
                    <input
                      value={humanNote}
                      onChange={(e) => setHumanNote(e.target.value)}
                      placeholder="判定原因或备注..."
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAnnotate("correct")}
                      className={`btn-success flex-1 ${
                        currentResult.humanJudgment === "correct"
                          ? "ring-2 ring-emerald-400 ring-offset-2"
                          : ""
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" /> 正确
                    </button>
                    <button
                      onClick={() => handleAnnotate("partial")}
                      className={`btn btn-warning flex-1 bg-amber-500 text-white hover:bg-amber-400 ${
                        currentResult.humanJudgment === "partial"
                          ? "ring-2 ring-amber-400 ring-offset-2"
                          : ""
                      }`}
                    >
                      <Minus className="w-4 h-4" /> 部分正确
                    </button>
                    <button
                      onClick={() => handleAnnotate("wrong")}
                      className={`btn-danger flex-1 ${
                        currentResult.humanJudgment === "wrong"
                          ? "ring-2 ring-red-400 ring-offset-2"
                          : ""
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" /> 错误
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <ParamsPanel />
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-sm text-slate-700">
                    历史记录
                  </span>
                  <span className="text-xs text-slate-400">
                    ({filteredHistory.length}/{history.length})
                  </span>
                </div>
                {filterTagIds.length > 0 && (
                  <button
                    onClick={() => setFilterTagIds([])}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500">标签筛选</span>
                </div>
                <TagSelector
                  selectedTagIds={filterTagIds}
                  onChange={setFilterTagIds}
                  placeholder="选择标签筛选"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchAllTags}
                    onChange={(e) => setMatchAllTags(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  同时满足所有标签
                </label>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  {history.length === 0
                    ? "暂无历史记录"
                    : "没有符合筛选条件的记录"}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredHistory.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setCurrentResult(r);
                        setQuestion(r.question);
                        setStandardAnswer(r.standardAnswer || "");
                        setHumanNote(r.humanNote || "");
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="text-sm text-slate-700 line-clamp-1 mb-1">
                        {r.question}
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {(r.tagIds || []).slice(0, 2).map((tagId) => {
                          const tag = getTagById(tagId);
                          return tag ? (
                            <TagBadge key={tagId} tag={tag} size="sm" />
                          ) : null;
                        })}
                        {(r.tagIds || []).length > 2 && (
                          <span className="text-[10px] text-slate-400">
                            +{(r.tagIds || []).length - 2}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        {judgmentBadge(r.humanJudgment)}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(r.createdAt).toLocaleTimeString("zh-CN")}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showTagEditor && currentResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                <TagIcon className="w-5 h-5 inline mr-2 text-primary-600" />
                编辑问答标签
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
                <p className="text-sm text-slate-600 line-clamp-2">
                  问题：
                  <span className="font-medium text-slate-800">
                    {currentResult.question}
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
