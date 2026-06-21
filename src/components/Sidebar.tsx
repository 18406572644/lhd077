import { NavLink } from "react-router-dom";
import {
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  GitCompare,
  Gauge,
  ScrollText,
  DatabaseZap,
} from "lucide-react";

const navItems = [
  { to: "/", label: "知识库管理", icon: BookOpen },
  { to: "/qa", label: "问答测试台", icon: MessageSquare },
  { to: "/evaluation", label: "批量评测", icon: ClipboardCheck },
  { to: "/compare", label: "版本对比", icon: GitCompare },
  { to: "/metrics", label: "指标管理", icon: Gauge },
  { to: "/logs", label: "系统日志", icon: ScrollText },
];

export default function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-gradient-to-b from-primary-800 to-primary-900 text-white flex flex-col">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-accent-400 flex items-center justify-center">
          <DatabaseZap className="w-5 h-5 text-primary-900" />
        </div>
        <div>
          <h1 className="font-serif text-base font-semibold tracking-wide">
            客服知识库评测台
          </h1>
          <p className="text-[10px] text-white/50 font-mono">QA Eval Bench</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent-400 text-primary-900 shadow-lg shadow-accent-400/20"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon className="w-4.5 h-4.5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40 font-mono">
        <div>v1.0.0 · 本地运行</div>
      </div>
    </aside>
  );
}
