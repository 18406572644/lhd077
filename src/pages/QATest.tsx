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
  GitCompare,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import VersionSelector from "@/components/VersionSelector";
import ParamsPanel from "@/components/ParamsPanel";
import TagSelector from "@/components/TagSelector";
import TagBadge from "@/components/TagBadge";
import type {
  QAResult,
  HumanJudgment,
  Tag,
  ABCompareResult,
  RetrievedChunk,
} from "../../shared/types";

const MAX_QUESTION_LENGTH = 2000;

function ResultChunkList({
  chunks,
  onlyChunkIds,
  accentClass,
}: {
  chunks: RetrievedChunk[];
  onlyChunkIds?: string[];
  accentClass?: string;
}) {
  const onlySet = new Set(onlyChunkIds ?? []);
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {chunks.map((c, i) => {
        const isOnly = onlySet.has(c.chunkId);
        return (
          <div
            key={c.chunkId}
            className={`p-3 rounded-md bg-slate-50 border border-slate-100 ${
              isOnly ? `ring-2 ring-inset ${accentClass ?? "ring-amber-300 bg-amber-50/50"}` : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary-600">
                #{i + 1} · {c.documentTitle}
              </span>
              <div className="flex items-center gap-1.5">
                {isOnly && (
                  <span className="text-[10px] font-medium text-amber-600">独有</span>
                )}
                <span className="text-xs font-mono text-slate-400">
                  score: {(c.score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 line-clamp-2">{c.content}</p>
          </div>
        );
      })}
    </div>
  );
}

function ResultPanel({
  title,
  result,
  badgeClass,
  accentClass,
  onlyChunkIds,
}: {
  title: string;
  result: QAResult;
  badgeClass: string;
  accentClass?: string;
  onlyChunkIds?: string[];
}) {
  return (
    <div className="card overflow-hidden animate-slide-up flex flex-col">
      <div
        className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between ${badgeClass}`}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-80">置信度</span>
          <div className="w-24 h-2 bg-slate-200/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all"
              style={{ width: `${result.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono opacity-90">
            {(result.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="p-5 flex-1 space-y-4">
        <div>
          <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 模型回答
          </div>
          <div className="text-sm text-slate-800 bg-primary-50/30 p-4 rounded-md border border-primary-100 leading-relaxed whitespace-pre-wrap">
            {result.answer}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <BookMarked className="w-3 h-3" /> 检索片段（{result.retrievedChunks.length}）
          </div>
          <ResultChunkList
            chunks={result.retrievedChunks}
            onlyChunkIds={onlyChunkIds}
            accentClass={accentClass}
          />
        </div>
      </div>
    </div>
  );
}

export default function QATest() {
  const {
    selectedVersionId,
    retrievalParams,
    abMode,
    retrievalParamsA,
    retrievalParamsB,
    setVersions,
    showToast,
  } = useAppStore();

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<QAResult | null>(null);
  const [abCompareResult, setAbCompareResult] = useState<ABCompareResult | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
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

  const activeResult = useMemo(() => {
    if (!abMode) return currentResult;
    if (!abCompareResult) return null;
    if (activeResultId === abCompareResult.resultB.id) return abCompareResult.resultB;
    return abCompareResult.resultA;
  }, [abMode, currentResult, abCompareResult, activeResultId]);

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
      if (abMode) {
        const compareRes = await api.qa.askAB({
          question,
          versionId: selectedVersionId,
          paramsA: retrievalParamsA,
          paramsB: retrievalParamsB,
        });
        setAbCompareResult(compareRes);
        setCurrentResult(null);
        setActiveResultId(compareRes.resultA.id);
        setStandardAnswer(compareRes.resultA.standardAnswer || "");
        setHumanNote(compareRes.resultA.humanNote || "");
        setHistory((h) =>
          [compareRes.resultA, compareRes.resultB, ...h].slice(0, 50)
        );
      } else {
        const result = await api.qa.ask({
          question,
          versionId: selectedVersionId,
          retrievalParams,
        });
        setCurrentResult(result);
        setAbCompareResult(null);
        setStandardAnswer(result.standardAnswer || "");
        setHumanNote(result.humanNote || "");
        setHistory((h) => [result, ...h].slice(0, 50));
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "问答失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotate = async (judgment: HumanJudgment) => {
    if (!activeResult) return;
    try {
      const updated = await api.qa.annotate({
        resultId: activeResult.id,
        judgment,
        note: humanNote || undefined,
        standardAnswer: standardAnswer || undefined,
      });
      if (abMode && abCompareResult) {
        const updatedCompare = { ...abCompareResult };
        if (updatedCompare.resultA.id === updated.id) {
          updatedCompare.resultA = updated;
        } else if (updatedCompare.resultB.id === updated.id) {
          updatedCompare.resultB = updated;
        }
        setAbCompareResult(updatedCompare);
      } else {
        setCurrentResult(updated);
      }
      setHistory((h) => h.map((r) => (r.id === updated.id ? updated : r)));
      showToast("判定已保存", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  const openTagEditor = () => {
    if (!activeResult) return;
    setEditingTagIds(activeResult.tagIds || []);
    setShowTagEditor(true);
  };

  const handleSaveTags = async () => {
    if (!activeResult) return;
    setSavingTags(true);
    try {
      const result = await api.tags.setEntityTags(
        "qa",
        activeResult.id,
        editingTagIds
      );
      const updated = { ...activeResult, tagIds: result.tagIds };
      if (abMode && abCompareResult) {
        const updatedCompare = { ...abCompareResult };
        if (updatedCompare.resultA.id === updated.id) {
          updatedCompare.resultA = updated;
        } else if (updatedCompare.resultB.id === updated.id) {
          updatedCompare.resultB = updated;
        }
        setAbCompareResult(updatedCompare);
      } else {
        setCurrentResult(updated);
      }
      setHistory((h) =>
        h.map((r) => (r.id === activeResult.id ? updated : r))
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
        description={
          abMode
            ? "A/B 参数对比模式：并行检索两组参数，并排对比结果差异"
            : "单条问答测试，检索片段展示，人工修订标准答案与判定"
        }
        actions={<VersionSelector />}
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                你的问题
              </label>
              {abMode && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  <GitCompare className="w-3.5 h-3.5" />
                  A/B 对比模式
                </span>
              )}
            </div>
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
                {loading ? "生成中..." : abMode ? "A/B 对比提问" : "提问"}
              </button>
            </div>
          </div>

          {abMode && abCompareResult && (
            <>
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-sm text-slate-700">
                      对比结果摘要
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">
                      回答差异：
                      <span
                        className={`font-semibold ml-1 ${
                          abCompareResult.diff.answerDiff ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {abCompareResult.diff.answerDiff ? "是" : "否"}
                      </span>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">
                      片段重叠：
                      <span className="font-semibold ml-1 text-slate-700">
                        {abCompareResult.diff.chunksOverlap}
                      </span>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">
                      置信度差(B-A)：
                      <span
                        className={`font-semibold ml-1 ${
                          abCompareResult.diff.confidenceDiff > 0
                            ? "text-emerald-600"
                            : abCompareResult.diff.confidenceDiff < 0
                              ? "text-rose-600"
                              : "text-slate-700"
                        }`}
                      >
                        {abCompareResult.diff.confidenceDiff > 0
                          ? `+${(abCompareResult.diff.confidenceDiff * 100).toFixed(1)}%`
                          : `${(abCompareResult.diff.confidenceDiff * 100).toFixed(1)}%`}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="px-5 py-3 bg-indigo-50/50 text-xs text-slate-600">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-blue-700">A 独有片段：</span>
                      <span className="ml-1 text-slate-500">
                        {abCompareResult.diff.chunksOnlyA.length} 条（黄色高亮）
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-violet-700">B 独有片段：</span>
                      <span className="ml-1 text-slate-500">
                        {abCompareResult.diff.chunksOnlyB.length} 条（黄色高亮）
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResultPanel
                  title="A 组结果"
                  result={abCompareResult.resultA}
                  badgeClass="bg-blue-50/50 text-blue-700"
                  accentClass="ring-blue-300"
                  onlyChunkIds={abCompareResult.diff.chunksOnlyA}
                />
                <ResultPanel
                  title="B 组结果"
                  result={abCompareResult.resultB}
                  badgeClass="bg-violet-50/50 text-violet-700"
                  accentClass="ring-violet-300"
                  onlyChunkIds={abCompareResult.diff.chunksOnlyB}
                />
              </div>

              <div className="card overflow-hidden mt-4">
                <div className="p-5 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileEdit className="w-4 h-4 text-primary-600" />
                    <span className="font-medium text-sm text-slate-700">
                      人工修订与判定
                    </span>
                    <select
                      value={activeResult?.id ?? ""}
                      onChange={(e) => {
                        setActiveResultId(e.target.value);
                        if (abCompareResult) {
                          if (e.target.value === abCompareResult.resultA.id) {
                            setStandardAnswer(abCompareResult.resultA.standardAnswer || "");
                            setHumanNote(abCompareResult.resultA.humanNote || "");
                          } else {
                            setStandardAnswer(abCompareResult.resultB.standardAnswer || "");
                            setHumanNote(abCompareResult.resultB.humanNote || "");
                          }
                        }
                      }}
                      className="input text-xs py-1 px-2 border border-slate-200 rounded ml-2"
                    >
                      <option value={abCompareResult.resultA.id}>A 组结果</option>
                      <option value={abCompareResult.resultB.id}>B 组结果</option>
                    </select>
                    {activeResult && (
                      <div className="ml-2">{judgmentBadge(activeResult.humanJudgment)}</div>
                    )}
                  </div>
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
                        activeResult?.humanJudgment === "correct"
                          ? "ring-2 ring-emerald-400 ring-offset-2"
                          : ""
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" /> 正确
                    </button>
                    <button
                      onClick={() => handleAnnotate("partial")}
                      className={`btn btn-warning flex-1 bg-amber-500 text-white hover:bg-amber-400 ${
                        activeResult?.humanJudgment === "partial"
                          ? "ring-2 ring-amber-400 ring-offset-2"
                          : ""
                      }`}
                    >
                      <Minus className="w-4 h-4" /> 部分正确
                    </button>
                    <button
                      onClick={() => handleAnnotate("wrong")}
                      className={`btn-danger flex-1 ${
                        activeResult?.humanJudgment === "wrong"
                          ? "ring-2 ring-red-400 ring-offset-2"
                          : ""
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" /> 错误
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {!abMode && currentResult && (
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
                    <BookMarked className="w-3 h-3" /> 检索片段（{currentResult.retrievedChunks.length}）
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
                        <p className="text-xs text-slate-600 line-clamp-2">{c.content}</p>
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
                        if (abMode) {
                          setAbCompareResult(null);
                        }
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

      {showTagEditor && activeResult && (
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
                    {activeResult.question}
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
