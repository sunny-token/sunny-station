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

  const { data: user } = trpc.auth.getMe.useQuery();
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between w-full px-4 md:px-0">
          <div className="w-12 h-12" /> {/* Spacer for centering */}
          <div className="inline-flex items-center justify-center p-4 mb-2 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.2)] backdrop-blur-xl">
            <Database className="w-10 h-10 text-indigo-400" />
          </div>
          <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-300 shadow-xl"
              title="退出系统"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
        
        <h1 className="relative z-10 text-5xl md:text-7xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 pb-2">
          数据处理引擎
        </h1>
        
        <p className="relative z-10 text-lg md:text-xl text-indigo-100/50 max-w-2xl mx-auto font-light tracking-wide">
          自动化彩票元数据抓取、同步与智能分析的中央控制台
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        
        {/* Card 1: SSQ */}
        <Link href="/lottery-crawler" className="group rounded-[2rem] p-8 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.12] hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="p-4 bg-red-500/10 rounded-2xl text-red-400 group-hover:scale-110 group-hover:text-red-300 transition-all duration-500 ease-out">
              <CircleDot className="w-7 h-7" />
            </div>
            <div className="peer p-2 rounded-full border border-white/0 group-hover:border-white/10 transition-all duration-300">
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-medium text-gray-200 mb-2 tracking-wide group-hover:text-white transition-colors">双色球引擎</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-light">管理红蓝球历史走势及最新开奖数据的自动化采集节点。</p>
          </div>
        </Link>

        {/* Card 2: DLT */}
        <Link href="/lottery-dlt-crawler" className="group rounded-[2rem] p-8 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.12] hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:scale-110 group-hover:text-amber-300 transition-all duration-500 ease-out">
              <Layers className="w-7 h-7" />
            </div>
            <div className="peer p-2 rounded-full border border-white/0 group-hover:border-white/10 transition-all duration-300">
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-medium text-gray-200 mb-2 tracking-wide group-hover:text-white transition-colors">大乐透引擎</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-light">管理前区与后区走势数据，提供高维度的开奖历史分析。</p>
          </div>
        </Link>

        {/* Card 3: Settings */}
        <Link href="/settings" className="group rounded-[2rem] p-8 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.12] hover:shadow-2xl hover:shadow-slate-500/10 transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between relative z-10 mb-8">
            <div className="p-4 bg-slate-500/10 rounded-2xl text-slate-400 group-hover:scale-110 group-hover:text-slate-300 group-hover:rotate-45 transition-all duration-500 ease-out">
              <Settings className="w-7 h-7" />
            </div>
            <div className="peer p-2 rounded-full border border-white/0 group-hover:border-white/10 transition-all duration-300">
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-medium text-gray-200 mb-2 tracking-wide group-hover:text-white transition-colors">系统配置中心</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-light">全局运行参数、数据源健康检查及核心调度配置。</p>
          </div>
        </Link>
      </div>

      {/* Global Actions Section */}
      {isAdmin && (
        <div className="mt-8 relative z-10">
          <div className="p-8 rounded-[2rem] bg-indigo-950/20 border border-indigo-500/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 w-full sm:w-auto">
              <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Activity className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-indigo-100 tracking-wide">全网数据聚合</h3>
                <p className="text-sm text-indigo-300/60 font-light mt-0.5">一键触发所有站点的增量更新</p>
              </div>
            </div>
            
            <Button
              size="lg"
              variant="default"
              disabled={loading}
              onClick={handleRefreshAll}
              className="w-full sm:w-auto px-8 h-14 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 overflow-hidden relative group border-0 text-base font-medium tracking-wide"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-3">
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "执行同步协议..." : "执行全局同步"}
              </span>
            </Button>
          </div>

          {/* Result Toast/Alert */}
          {result && (
            <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300 relative z-10">
              <div className="p-4 px-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <p className="text-indigo-200 font-light tracking-wide text-sm">{result}</p>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
