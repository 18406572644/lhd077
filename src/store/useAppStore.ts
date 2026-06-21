import { create } from "zustand";
import type {
  KnowledgeVersion,
  RetrievalParams,
} from "../../shared/types";

interface AppState {
  versions: KnowledgeVersion[];
  selectedVersionId: string | null;
  retrievalParams: RetrievalParams;
  toast: { message: string; type: "success" | "error" | "info" | "warn" } | null;
  setVersions: (v: KnowledgeVersion[]) => void;
  setSelectedVersionId: (id: string | null) => void;
  setRetrievalParams: (p: Partial<RetrievalParams>) => void;
  showToast: (message: string, type?: "success" | "error" | "info" | "warn") => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  versions: [],
  selectedVersionId: null,
  retrievalParams: {
    topK: 5,
    minScore: 0.1,
    chunkSize: 300,
    chunkOverlap: 50,
    useBM25: true,
  },
  toast: null,
  setVersions: (v) => set({ versions: v, selectedVersionId: v[0]?.id ?? null }),
  setSelectedVersionId: (id) => set({ selectedVersionId: id }),
  setRetrievalParams: (p) =>
    set((s) => ({ retrievalParams: { ...s.retrievalParams, ...p } })),
  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),
}));
