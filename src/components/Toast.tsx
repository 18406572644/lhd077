import { CheckCircle2, XCircle, Info, X, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function Toast() {
  const { toast, clearToast } = useAppStore();
  if (!toast) return null;
  const styles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
  };
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
    warn: AlertTriangle,
  };
  const Icon = icons[toast.type];
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${styles[toast.type]}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={clearToast}
          className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
