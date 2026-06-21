import { useAppStore } from "@/store/useAppStore";
import { Layers } from "lucide-react";

interface Props {
  showAll?: boolean;
}

export default function VersionSelector({ showAll = false }: Props) {
  const { versions, selectedVersionId, setSelectedVersionId } = useAppStore();
  return (
    <div className="flex items-center gap-2">
      <Layers className="w-4 h-4 text-slate-500" />
      <select
        value={selectedVersionId ?? ""}
        onChange={(e) => setSelectedVersionId(e.target.value || null)}
        className="input py-1.5 text-sm w-64"
      >
        {showAll && (
          <option value="">全部版本</option>
        )}
        {versions.length === 0 && <option value="">暂无知识库版本</option>}
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} · {v.documentIds.length}篇 · {v.indexStatus}
          </option>
        ))}
      </select>
    </div>
  );
}
