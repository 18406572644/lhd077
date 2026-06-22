import { create } from "zustand";
import type {
  KnowledgeVersion,
  RetrievalParams,
} from "../../shared/types";

const DEFAULT_PARAMS: RetrievalParams = {
  topK: 5,
  minScore: 0.1,
  chunkSize: 300,
  chunkOverlap: 50,
  useBM25: true,
};

interface AppState {
  versions: KnowledgeVersion[];
  selectedVersionId: string | null;
  retrievalParams: RetrievalParams;
  abMode: boolean;
  retrievalParamsA: RetrievalParams;
  retrievalParamsB: RetrievalParams;
  toast: { message: string; type: "success" | "error" | "info" | "warn" } | null;
  setVersions: (v: KnowledgeVersion[]) => void;
  setSelectedVersionId: (id: string | null) => void;
  setRetrievalParams: (p: Partial<RetrievalParams>) => void;
  setAbMode: (enabled: boolean) => void;
  setRetrievalParamsA: (p: Partial<RetrievalParams>) => void;
  setRetrievalParamsB: (p: Partial<RetrievalParams>) => void;
  swapABParams: () => void;
  copyParamsAToB: () => void;
  applyBestParams: (p: RetrievalParams) => void;
  showToast: (message: string, type?: "success" | "error" | "info" | "warn") => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  versions: [],
  selectedVersionId: null,
  retrievalParams: { ...DEFAULT_PARAMS },
  abMode: false,
  retrievalParamsA: { ...DEFAULT_PARAMS },
  retrievalParamsB: { ...DEFAULT_PARAMS, topK: 10, chunkSize: 500 },
  toast: null,
  setVersions: (v) => set({ versions: v, selectedVersionId: v[0]?.id ?? null }),
  setSelectedVersionId: (id) => set({ selectedVersionId: id }),
  setRetrievalParams: (p) =>
    set((s) => ({ retrievalParams: { ...s.retrievalParams, ...p } })),
  setAbMode: (enabled) => set({ abMode: enabled }),
  setRetrievalParamsA: (p) =>
    set((s) => ({ retrievalParamsA: { ...s.retrievalParamsA, ...p } })),
  setRetrievalParamsB: (p) =>
    set((s) => ({ retrievalParamsB: { ...s.retrievalParamsB, ...p } })),
  swapABParams: () =>
    set((s) => ({
      retrievalParamsA: s.retrievalParamsB,
      retrievalParamsB: s.retrievalParamsA,
    })),
  copyParamsAToB: () =>
    set((s) => ({ retrievalParamsB: { ...s.retrievalParamsA } })),
  applyBestParams: (p) =>
    set(() => ({
      retrievalParams: { ...p },
      retrievalParamsA: { ...p },
    })),
  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),
}));
