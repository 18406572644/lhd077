import { useAppStore } from "@/store/useAppStore";
import { Sliders, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export default function ParamsPanel() {
  const [open, setOpen] = useState(false);
  const { retrievalParams, setRetrievalParams } = useAppStore();
  return (
    <div className="card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-sm text-slate-700">检索参数配置</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Top-K 检索数</label>
              <input
                type="number"
                min={1}
                max={50}
                value={retrievalParams.topK}
                onChange={(e) =>
                  setRetrievalParams({ topK: Number(e.target.value) })
                }
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">最低匹配分</label>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={retrievalParams.minScore}
                onChange={(e) =>
                  setRetrievalParams({ minScore: Number(e.target.value) })
                }
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">切分块大小</label>
              <input
                type="number"
                min={50}
                max={2000}
                value={retrievalParams.chunkSize}
                onChange={(e) =>
                  setRetrievalParams({ chunkSize: Number(e.target.value) })
                }
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">块重叠</label>
              <input
                type="number"
                min={0}
                max={500}
                value={retrievalParams.chunkOverlap}
                onChange={(e) =>
                  setRetrievalParams({ chunkOverlap: Number(e.target.value) })
                }
                className="input text-sm py-1.5"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={retrievalParams.useBM25}
              onChange={(e) => setRetrievalParams({ useBM25: e.target.checked })}
              className="w-4 h-4 accent-primary-600"
            />
            使用 BM25 评分算法
          </label>
        </div>
      )}
    </div>
  );
}
