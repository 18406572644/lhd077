import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import Knowledge from "@/pages/Knowledge";
import QATest from "@/pages/QATest";
import Evaluation from "@/pages/Evaluation";
import Compare from "@/pages/Compare";
import Logs from "@/pages/Logs";
import Metrics from "@/pages/Metrics";
import Settings from "@/pages/Settings";
import ScheduledEvaluation from "@/pages/ScheduledEvaluation";
import TrendReport from "@/pages/TrendReport";
import Tags from "@/pages/Tags";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 p-8 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Knowledge />} />
            <Route path="/qa" element={<QATest />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/scheduled-evaluation" element={<ScheduledEvaluation />} />
            <Route path="/trend/:id" element={<TrendReport />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <Toast />
      </div>
    </Router>
  );
}
