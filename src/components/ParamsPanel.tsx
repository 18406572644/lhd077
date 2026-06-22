import { useAppStore } from "@/store/useAppStore";
import { Sliders, ChevronDown, ChevronUp, ArrowLeftRight, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import type { RetrievalParams } from "../../shared/types";
import { api } from "@/lib/api";

type ParamKey = keyof RetrievalParams;

interface ParamFieldProps {
  label: string;
  paramKey?: ParamKey;
  value: number | boolean;
  onChange: (v: number | boolean) => void;
  min?: number;
  max?: number;
  step?: number;
  isDifferent?: boolean;
  accentClass?: string;
}

function ParamField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  isDifferent,
  accentClass,
}: ParamFieldProps) {
  const isBool = typeof value === "boolean";
  const ringClass = isDifferent ? `ring-2 ${accentClass ?? "ring-amber-300"}` : "";

  if (isBool) {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className={`w-4 h-4 accent-primary-600 ${ringClass} rounded`}
        />
        {label}
        {isDifferent && (
          <span className="text-[10px] text-amber-600 font-medium">● 差异</span>
        )}
      </label>
    );
  }

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
        {label}
        {isDifferent && (
          <span className="text-[10px] text-amber-600 font-medium">●差异</span>
        )}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value as number}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`input text-sm py-1.5 ${ringClass}`}
      />
    </div>
  );
}

interface ParamGroupProps {
  groupLabel: string;
  badgeColor: string;
  params: RetrievalParams;
  setParams: (p: Partial<RetrievalParams>) => void;
  diffMap: Partial<Record<ParamKey, boolean>>;
  accent: string;
}

function ParamGroup({
  groupLabel,
  badgeColor,
  params,
  setParams,
  diffMap,
  accent,
}: ParamGroupProps) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
        {groupLabel}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ParamField
          label="Top-K 检索数"
          paramKey="topK"
          value={params.topK}
          onChange={(v) => setParams({ topK: v as number })}
          min={1}
          max={50}
          isDifferent={diffMap.topK}
          accentClass={accent}
        />
        <ParamField
          label="最低匹配分"
          paramKey="minScore"
          value={params.minScore}
          onChange={(v) => setParams({ minScore: v as number })}
          min={0}
          max={1}
          step={0.05}
          isDifferent={diffMap.minScore}
          accentClass={accent}
        />
        <ParamField
          label="切分块大小"
          paramKey="chunkSize"
          value={params.chunkSize}
          onChange={(v) => setParams({ chunkSize: v as number })}
          min={50}
          max={2000}
          isDifferent={diffMap.chunkSize}
          accentClass={accent}
        />
        <ParamField
          label="块重叠"
          paramKey="chunkOverlap"
          value={params.chunkOverlap}
          onChange={(v) => setParams({ chunkOverlap: v as number })}
          min={0}
          max={500}
          isDifferent={diffMap.chunkOverlap}
          accentClass={accent}
        />
      </div>
      <ParamField
        label="使用 BM25 评分算法"
        paramKey="useBM25"
        value={params.useBM25}
        onChange={(v) => setParams({ useBM25: v as boolean })}
        isDifferent={diffMap.useBM25}
        accentClass={accent}
      />
    </div>
  );
}

export default function ParamsPanel() {
  const [open, setOpen] = useState(false);
  const {
    retrievalParams,
    setRetrievalParams,
    abMode,
    setAbMode,
    retrievalParamsA,
    retrievalParamsB,
    setRetrievalParamsA,
    setRetrievalParamsB,
    swapABParams,
    copyParamsAToB,
    applyBestParams,
    selectedVersionId,
    showToast,
  } = useAppStore();

  const [recLoading, setRecLoading] = useState(false);

  const diffMap: Partial<Record<ParamKey, boolean>> = {};
  if (abMode) {
    (Object.keys(retrievalParamsA) as ParamKey[]).forEach((k) => {
      if (retrievalParamsA[k] !== retrievalParamsB[k]) diffMap[k] = true;
    });
  }
  const hasDiff = Object.values(diffMap).some(Boolean);

  const handleLoadRecommendation = async () => {
    if (!selectedVersionId) {
      showToast("请先选择知识库版本", "error");
      return;
    }
    setRecLoading(true);
    try {
      const rec = await api.qa.getParamsRecommendation(selectedVersionId);
      applyBestParams(rec.bestParams);
      showToast(
        `已应用最优参数：准确率 ${(rec.bestStats.accuracy * 100).toFixed(0)}%（样本 ${rec.sampleSize}）`,
        "success",
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载推荐失败", "warn");
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <div className="card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-sm text-slate-700">检索参数配置</span>
          {abMode && (
            <span className="badge bg-indigo-50 text-indigo-700">A/B 对比</span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={abMode}
                onChange={(e) => setAbMode(e.target.checked)}
                className="w-4 h-4 accent-primary-600"
              />
              启用 A/B 参数对比
            </label>
            <button
              onClick={handleLoadRecommendation}
              disabled={recLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 rounded-md hover:bg-primary-100 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {recLoading ? "分析中..." : "最优参数推荐"}
            </button>
          </div>

          {!abMode && (
            <div className="grid grid-cols-2 gap-3">
              <ParamField
                label="Top-K 检索数"
                paramKey="topK"
                value={retrievalParams.topK}
                onChange={(v) => setRetrievalParams({ topK: v as number })}
                min={1}
                max={50}
              />
              <ParamField
                label="最低匹配分"
                paramKey="minScore"
                value={retrievalParams.minScore}
                onChange={(v) => setRetrievalParams({ minScore: v as number })}
                min={0}
                max={1}
                step={0.05}
              />
              <ParamField
                label="切分块大小"
                paramKey="chunkSize"
                value={retrievalParams.chunkSize}
                onChange={(v) => setRetrievalParams({ chunkSize: v as number })}
                min={50}
                max={2000}
              />
              <ParamField
                label="块重叠"
                paramKey="chunkOverlap"
                value={retrievalParams.chunkOverlap}
                onChange={(v) => setRetrievalParams({ chunkOverlap: v as number })}
                min={0}
                max={500}
              />
            </div>
          )}

          {!abMode && (
            <ParamField
              label="使用 BM25 评分算法"
              paramKey="useBM25"
              value={retrievalParams.useBM25}
              onChange={(v) => setRetrievalParams({ useBM25: v as boolean })}
            />
          )}

          {abMode && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={swapABParams}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                  title="交换 A/B 参数"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  交换 A/B
                </button>
                <button
                  onClick={copyParamsAToB}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                  title="将 A 组参数复制到 B 组"
                >
                  <Copy className="w-3.5 h-3.5" />
                  复制 A→B
                </button>
                {hasDiff && (
                  <span className="text-xs text-amber-600 ml-auto">
                    检测到 {Object.keys(diffMap).length} 个参数差异
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ParamGroup
                  groupLabel="A 组参数"
                  badgeColor="bg-blue-50 text-blue-700"
                  params={retrievalParamsA}
                  setParams={setRetrievalParamsA}
                  diffMap={diffMap}
                  accent="ring-blue-300"
                />
                <ParamGroup
                  groupLabel="B 组参数"
                  badgeColor="bg-violet-50 text-violet-700"
                  params={retrievalParamsB}
                  setParams={setRetrievalParamsB}
                  diffMap={diffMap}
                  accent="ring-violet-300"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
