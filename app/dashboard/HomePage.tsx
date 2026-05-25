"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trpc } from "@/server/client";
import { Database, RefreshCw, Settings, CircleDot, Layers, ChevronRight, Activity, LogOut } from "lucide-react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const refreshAllMutation = trpc.refreshAll.useMutation();

  const { data: user, isLoading: userLoading } = trpc.auth.getMe.useQuery();
  const isAdmin = user?.role === "ADMIN";

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    }
  });

  const handleRefreshAll = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await refreshAllMutation.mutateAsync();
      if (res.success) {
        const ssqCount = res.ssq?.count || 0;
        const dltCount = res.dlt?.count || 0;
        setResult(
          `同步成功 / 双色球: +${ssqCount} / 大乐透: +${dltCount}`
        );
      } else {
        setResult("同步失败：节点响应异常");
      }
    } catch (e) {
      setResult(`连接阻断: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* Header */}
      <div className="text-center space-y-6 pt-10 pb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-200/40 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-rose-100/30 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between w-full px-4 md:px-0">
          <div className="w-12 h-12" /> {/* Spacer for centering */}
          <div className="inline-flex items-center justify-center p-4 mb-2 rounded-2xl bg-white/70 border border-slate-200/80 shadow-[0_8px_30px_rgba(99,102,241,0.06)] backdrop-blur-xl">
            <Database className="w-10 h-10 text-indigo-500" />
          </div>
          <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white/60 border border-slate-200/80 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-xl"
              title="退出系统"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
        
        <h1 className="relative z-10 text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 pb-2">
          数据处理引擎
        </h1>
        
        <p className="relative z-10 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-light tracking-wide">
          自动化开奖数据抓取、同步与智能对奖的中央管理后台
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Card 1: SSQ */}
        <Link href="/lottery-crawler" className="group rounded-[2.5rem] p-8 bg-white/60 border border-slate-200/80 hover:bg-white/95 hover:border-red-200 hover:shadow-[0_20px_50px_rgba(239,68,68,0.06)] backdrop-blur-xl transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="p-4 bg-red-50 rounded-2xl text-red-500 group-hover:scale-110 group-hover:bg-red-500 group-hover:text-white transition-all duration-500 ease-out">
              <CircleDot className="w-7 h-7" />
            </div>
            <div className="peer p-2 rounded-full border border-slate-100 bg-slate-50 text-slate-400 group-hover:border-red-200 group-hover:bg-red-50 group-hover:text-red-500 transition-all duration-300">
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-wide group-hover:text-red-600 transition-colors">双色球数据中心</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-light">管理红蓝球历史走势及最新开奖数据的自动化采集模块。</p>
          </div>
        </Link>

        {/* Card 2: DLT */}
        <Link href="/lottery-dlt-crawler" className="group rounded-[2.5rem] p-8 bg-white/60 border border-slate-200/80 hover:bg-white/95 hover:border-amber-200 hover:shadow-[0_20px_50px_rgba(245,158,11,0.06)] backdrop-blur-xl transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500 ease-out">
              <Layers className="w-7 h-7" />
            </div>
            <div className="peer p-2 rounded-full border border-slate-100 bg-slate-50 text-slate-400 group-hover:border-amber-200 group-hover:bg-amber-50 group-hover:text-amber-600 transition-all duration-300">
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-wide group-hover:text-amber-600 transition-colors">大乐透数据中心</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-light">管理前区与后区走势数据，提供全方位的开奖历史分析。</p>
          </div>
        </Link>

        {/* Card 4: Settings */}
        <Link href="/settings" className="group rounded-[2.5rem] p-8 bg-white/60 border border-slate-200/80 hover:bg-white/95 hover:border-indigo-200 hover:shadow-[0_20px_50px_rgba(99,102,241,0.06)] backdrop-blur-xl transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-500 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white group-hover:rotate-45 transition-all duration-500 ease-out">
              <Settings className="w-7 h-7" />
            </div>
            <div className="peer p-2 rounded-full border border-slate-100 bg-slate-50 text-slate-400 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all duration-300">
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-wide group-hover:text-indigo-600 transition-colors">系统参数设置</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-light">全局运行参数配置、数据源健康检查及核心调度管理。</p>
          </div>
        </Link>
      </div>

      {/* Global Actions Section */}
      {userLoading ? (
        <div className="mt-8 relative z-10">
          <div className="p-8 rounded-[2.5rem] bg-white/40 border border-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-6 h-[114px] animate-pulse">
            <div className="flex items-center gap-5 w-full">
              <div className="p-3 bg-slate-100 rounded-xl w-12 h-12" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-200 rounded-lg w-1/4" />
                <div className="h-4 bg-slate-100 rounded-lg w-1/3" />
              </div>
            </div>
          </div>
        </div>
      ) : isAdmin ? (
        <div className="mt-8 relative z-10">
          <div className="p-8 rounded-[2.5rem] bg-white/60 border border-indigo-100 shadow-[0_12px_40px_rgba(99,102,241,0.04)] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 w-full sm:w-auto">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-500">
                <Activity className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800 tracking-wide">全网数据聚合</h3>
                <p className="text-sm text-slate-500 font-light mt-0.5">一键触发所有站点的增量更新</p>
              </div>
            </div>
            
            <Button
              size="lg"
              variant="default"
              disabled={loading}
              onClick={handleRefreshAll}
              className="w-full sm:w-auto px-8 h-14 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_12px_24px_rgba(79,70,229,0.25)] hover:shadow-[0_16px_32px_rgba(79,70,229,0.35)] transition-all duration-300 overflow-hidden relative group border-0 text-base font-semibold tracking-wide"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-3">
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "正在同步数据..." : "执行全量同步"}
              </span>
            </Button>
          </div>

          {/* Result Toast/Alert */}
          {result && (
            <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300 relative z-10">
              <div className="p-4 px-6 rounded-2xl bg-indigo-500/5 border border-indigo-200/30 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-indigo-800 font-light tracking-wide text-sm">{result}</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

    </div>
  );
}
