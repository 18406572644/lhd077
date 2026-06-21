import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import Knowledge from "@/pages/Knowledge";
import QATest from "@/pages/QATest";
import Evaluation from "@/pages/Evaluation";
import Compare from "@/pages/Compare";
import Logs from "@/pages/Logs";

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
            <Route path="/compare" element={<Compare />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
        <Toast />
      </div>
    </Router>
  );
}
