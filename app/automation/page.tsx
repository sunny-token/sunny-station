"use client";

import { useState, useRef, useEffect } from "react";
import {
  Github,
  Briefcase,
  Play,
  Terminal,
  Loader2,
  ChevronLeft,
  RefreshCw,
  Zap,
  ShieldCheck,
  Code2,
} from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: string;
  type: "info" | "success" | "error" | "system";
  content: string;
  timestamp: string;
}

export default function AutomationPage() {
  const [githubLogs, setGithubLogs] = useState<LogEntry[]>([]);
  const [careerLogs, setCareerLogs] = useState<LogEntry[]>([]);
  const [githubStatus, setGithubStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [careerStatus, setCareerStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");

  const githubScrollRef = useRef<HTMLDivElement>(null);
  const careerScrollRef = useRef<HTMLDivElement>(null);

  const addLog = (
    setter: React.Dispatch<React.SetStateAction<LogEntry[]>>,
    content: string,
    type: LogEntry["type"] = "info",
  ) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(7),
      type,
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    setter((prev) => [...prev, newLog].slice(-100)); // Keep last 100 logs
  };

  const autoScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  useEffect(() => autoScroll(githubScrollRef), [githubLogs]);
  useEffect(() => autoScroll(careerScrollRef), [careerLogs]);

  const runWorkflow = async (
    type: "github" | "career",
    endpoint: string,
    setStatus: React.Dispatch<
      React.SetStateAction<"idle" | "running" | "done" | "error">
    >,
    setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>,
  ) => {
    setStatus("running");
    setLogs([]);
    addLog(
      setLogs,
      `Initializing ${type} synchronization protocol...`,
      "system",
    );
    addLog(setLogs, `Connecting to endpoint: ${endpoint}`, "system");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: type === "github" ? "GitHub" : "职场" }),
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      if (!response.body) throw new Error("No response body received");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const data = JSON.parse(line.replace("data:", "").trim());

              // Handle Coze SSE format
              if (data.event === "message") {
                const content = data.message?.content;
                if (content) {
                  addLog(setLogs, content, "info");
                }
              } else if (data.event === "error") {
                addLog(
                  setLogs,
                  data.error?.message || "Unknown error",
                  "error",
                );
              } else if (data.event === "done") {
                addLog(
                  setLogs,
                  "Workflow execution completed successfully.",
                  "success",
                );
              }
            } catch {
              // If not JSON, just log as text if it's not empty
              const text = line.replace("data:", "").trim();
              if (text) addLog(setLogs, text, "info");
            }
          }
        }
      }

      setStatus("done");
    } catch (error: any) {
      console.error(error);
      addLog(setLogs, `Critical Error: ${error.message}`, "error");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMikiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_90%)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-400 transition-colors group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              返回主控制台
            </Link>
            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase flex items-center gap-4">
                自动化协作中心
                <span className="hidden md:inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] tracking-[0.3em]">
                  专业版 v2.4.0
                </span>
              </h1>
              <p className="text-slate-500 font-mono text-sm tracking-widest uppercase">
                自动化与工作流同步中心
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <Zap className="w-5 h-5 text-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                系统负载
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="w-[35%] h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                </div>
                <span className="text-[10px] font-mono text-indigo-400">
                  运行良好
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* GitHub Workflow */}
          <div className="group relative flex flex-col h-[640px] rounded-[2.5rem] bg-[#0a0a0c]/80 border border-white/[0.06] backdrop-blur-3xl overflow-hidden transition-all duration-500 hover:border-indigo-500/30 hover:shadow-[0_0_50px_rgba(99,102,241,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            {/* Card Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-500">
                  <Github className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    GitHub 趋势同步
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Star History 实时抓取 \ Coze 转发
                  </p>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                  githubStatus === "running"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 animate-pulse"
                    : githubStatus === "done"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : githubStatus === "error"
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-white/5 border-white/10 text-slate-500"
                }`}
              >
                {githubStatus}
              </div>
            </div>

            {/* Console Output */}
            <div className="flex-1 px-6 py-4">
              <div className="h-full rounded-3xl bg-black/40 border border-white/5 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                      运行日志
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
                  </div>
                </div>
                <div
                  ref={githubScrollRef}
                  className="flex-1 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed space-y-2 custom-scrollbar"
                >
                  {githubLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center opacity-20 flex-col gap-4 grayscale">
                      <Code2 className="w-12 h-12" />
                      <p className="tracking-[0.2em] text-[10px] font-bold uppercase">
                        等待连接中
                      </p>
                    </div>
                  ) : (
                    githubLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300"
                      >
                        <span className="text-slate-600 shrink-0 select-none">
                          [{log.timestamp}]
                        </span>
                        <span
                          className={
                            log.type === "success"
                              ? "text-emerald-400 font-bold"
                              : log.type === "error"
                                ? "text-red-400 font-bold"
                                : log.type === "system"
                                  ? "text-indigo-400 italic"
                                  : "text-slate-300"
                          }
                        >
                          {log.content}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-8 pt-4">
              <button
                onClick={() =>
                  runWorkflow(
                    "github",
                    "/api/cron/wechat-to-coze-github",
                    setGithubStatus,
                    setGithubLogs,
                  )
                }
                disabled={githubStatus === "running"}
                className="group relative w-full h-14 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.2em] overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                <div className="flex items-center justify-center gap-3">
                  {githubStatus === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  {githubStatus === "running"
                    ? "正在同步中..."
                    : "开始抓取"}
                </div>
              </button>
            </div>
          </div>

          {/* Career Workflow */}
          <div className="group relative flex flex-col h-[640px] rounded-[2.5rem] bg-[#0a0a0c]/80 border border-white/[0.06] backdrop-blur-3xl overflow-hidden transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            {/* Card Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-500">
                  <Briefcase className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    职场热点生成
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Gemini 智力引擎 \ 百度热搜感知
                  </p>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                  careerStatus === "running"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                    : careerStatus === "done"
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                      : careerStatus === "error"
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-white/5 border-white/10 text-slate-500"
                }`}
              >
                {careerStatus === "running" ? "运行中" : careerStatus === "done" ? "已完成" : careerStatus === "error" ? "错误" : "空闲"}
              </div>
            </div>

            {/* Console Output */}
            <div className="flex-1 px-6 py-4">
              <div className="h-full rounded-3xl bg-black/40 border border-white/5 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                      运行日志
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
                  </div>
                </div>
                <div
                  ref={careerScrollRef}
                  className="flex-1 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed space-y-2 custom-scrollbar"
                >
                  {careerLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center opacity-20 flex-col gap-4 grayscale">
                      <ShieldCheck className="w-12 h-12" />
                      <p className="tracking-[0.2em] text-[10px] font-bold uppercase">
                        等待指令下达
                      </p>
                    </div>
                  ) : (
                    careerLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300"
                      >
                        <span className="text-slate-600 shrink-0 select-none">
                          [{log.timestamp}]
                        </span>
                        <span
                          className={
                            log.type === "success"
                              ? "text-indigo-400 font-bold"
                              : log.type === "error"
                                ? "text-red-400 font-bold"
                                : log.type === "system"
                                  ? "text-emerald-400 italic"
                                  : "text-slate-300"
                          }
                        >
                          {log.content}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-8 pt-4">
              <button
                onClick={() =>
                  runWorkflow(
                    "career",
                    "/api/cron/wechat-to-coze",
                    setCareerStatus,
                    setCareerLogs,
                  )
                }
                disabled={careerStatus === "running"}
                className="group relative w-full h-14 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.2em] overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                <div className="flex items-center justify-center gap-3">
                  {careerStatus === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {careerStatus === "running"
                    ? "正在生成中..."
                    : "开始生成热点"}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 px-4 py-8 border-t border-white/5 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              COZE 服务在线
            </span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              AI 引擎已连接
            </span>
          </div>
          <p>© 2026 SUNNY STATION 系统. 版权所有.</p>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        `}</style>
      </div>
    </div>
  );
}
