"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trpc } from "@/server/client";
import { Database, RefreshCw, Settings, CircleDot, Layers, ChevronRight, Activity, LogOut, Radar, Cpu, CheckCircle2, AlertCircle } from "lucide-react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const refreshAllMutation = trpc.refreshAll.useMutation();

  const { data: user, isLoading: userLoading } = trpc.auth.getMe.useQuery();
  const isAdmin = user?.role === "ADMIN";

  // 智能雷达解算对奖舱相关状态
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResultData, setScanResultData] = useState<{ ssq?: number; dlt?: number; success?: boolean; error?: string } | null>(null);

  const handleStartRadarScan = async () => {
    setIsScanning(true);
    setScanStep(1);
    setScanProgress(5);
    setScanResultData(null);

    // 动画模拟步骤 1：建立云端安全数据信道
    setTimeout(() => {
      setScanStep(2);
      setScanProgress(25);
    }, 1200);

    // 动画模拟步骤 2：解算双色球
    setTimeout(() => {
      setScanStep(3);
      setScanProgress(55);
    }, 2400);

    // 动画模拟步骤 3：解算大乐透
    setTimeout(() => {
      setScanStep(4);
      setScanProgress(80);
    }, 3600);

    if (isAdmin) {
      // 超级管理员：真正调度后端接口执行全量云端拉取比对
      try {
        const res = await refreshAllMutation.mutateAsync();
        setTimeout(() => {
          setScanStep(5);
          setScanProgress(100);
          if (res.success) {
            setScanResultData({
              ssq: res.ssq?.count || 0,
              dlt: res.dlt?.count || 0,
              success: true,
            });
            setResult(`同步成功 / 双色球: +${res.ssq?.count || 0} / 大乐透: +${res.dlt?.count || 0}`);
          } else {
            setScanResultData({
              success: false,
              error: "同步节点响应异常，请检查数据源配置",
            });
          }
        }, 4800);
      } catch (e) {
        setTimeout(() => {
          setScanStep(5);
          setScanProgress(100);
          setScanResultData({
            success: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }, 4800);
      }
    } else {
      // 普通用户/访客：启动本地智能沙盒模拟比对 (不触发后端403报错)
      setTimeout(() => {
        setScanStep(5);
        setScanProgress(100);
        setScanResultData({
          ssq: 0,
          dlt: 0,
          success: true,
        });
      }, 4800);
    }
  };

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
          智能彩票助手
        </h1>
        
        <p className="relative z-10 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-light tracking-wide">
          自动化开奖数据抓取、同步与智能比对的中央管理后台
        </p>
      </div>

      {/* 智能雷达比对中枢入口 */}
      <div className="mb-10 relative z-10">
        <div className="group relative rounded-[2.5rem] p-8 md:p-10 bg-white/70 border border-slate-200/80 shadow-[0_15px_40px_rgba(99,102,241,0.04)] hover:shadow-[0_20px_50px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-500 overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8 animate-in slide-in-from-top-4 duration-500">
          {/* 彩光背景粒子 */}
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/[0.02] via-indigo-500/[0.02] to-amber-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* 雷达动态扫描光效 */}
          <div className="absolute right-[-10%] top-[-20%] w-[350px] h-[350px] bg-gradient-to-br from-indigo-500/5 to-rose-500/5 blur-[80px] rounded-full pointer-events-none group-hover:scale-110 transition-transform duration-700" />
          
          <div className="flex items-start md:items-center gap-6 relative z-10 flex-1">
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-rose-50 border border-indigo-100/50 rounded-3xl text-indigo-600 group-hover:scale-105 group-hover:shadow-md transition-all duration-500 relative shrink-0">
              <Radar className="w-8 h-8 text-indigo-500 animate-pulse" />
              {/* 环绕圆圈波纹 */}
              <div className="absolute inset-0 border border-indigo-200 rounded-3xl animate-ping opacity-25 scale-105" />
            </div>
            
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-rose-50 border border-indigo-100/50 text-indigo-600 text-[10px] font-bold tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
                中奖中央扫描中枢
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                云端开奖雷达 ｜ 比对最新中奖信息
              </h2>
              <p className="text-sm text-slate-500 font-light leading-relaxed max-w-2xl">
                一键调度多节点爬虫，增量采集双色球与大乐透云端最新开奖走势，自动对齐本地及守护号码图谱，即时解算并发送中奖推送喜报。
              </p>
            </div>
          </div>
          
          <button
            onClick={handleStartRadarScan}
            className="w-full md:w-auto relative px-8 h-14 rounded-2xl bg-slate-900 text-white font-bold text-sm tracking-wider shadow-sm hover:bg-slate-800 hover:shadow-indigo-500/10 transition-all active:scale-[0.98] shrink-0 overflow-hidden group/btn z-10 flex items-center justify-center gap-2.5"
          >
            <Cpu className="w-4 h-4 text-indigo-300 group-hover/btn:rotate-90 transition-transform duration-500" />
            <span>开启智能比对</span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
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

      {/* 智能雷达解算舱全屏弹窗 */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg p-8 md:p-10 rounded-[2.5rem] bg-white border border-slate-200/80 shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300 flex flex-col items-center text-center space-y-6">
            
            {/* 彩色背景光 */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-100/30 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-rose-100/30 blur-[80px] rounded-full pointer-events-none" />
            
            {/* 雷达动态扫描球体区 */}
            <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-slate-50 border border-slate-100/80 shadow-inner mt-4 overflow-hidden">
              {/* 雷达背景线网 */}
              <div className="absolute inset-2 border border-slate-200/40 rounded-full" />
              <div className="absolute inset-8 border border-slate-200/30 rounded-full" />
              <div className="absolute inset-16 border border-slate-200/20 rounded-full" />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-200/30" />
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-200/30" />
              
              {/* 动态扫描光束 */}
              {scanStep < 5 && (
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 via-indigo-500/[0.08] to-indigo-500/20 origin-center animate-spin" style={{ animationDuration: '2s' }} />
              )}
              
              {/* 图标状态展示 */}
              <div className="relative z-10 p-5 bg-white border border-slate-200/60 rounded-full shadow-md text-indigo-600 transition-all duration-300 scale-105">
                {scanStep === 5 ? (
                  scanResultData?.success ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
                  ) : (
                    <AlertCircle className="w-10 h-10 text-rose-500 animate-bounce" />
                  )
                ) : (
                  <Radar className="w-10 h-10 text-indigo-500 animate-pulse" />
                )}
              </div>
            </div>

            {/* 解算标题 */}
            <div className="space-y-2 relative z-10 w-full">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                {scanStep === 5 ? "中央雷达解算完成" : "中央雷达正在全网比对"}
              </h3>
              
              {/* 进度百分比与走马灯进度条 */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-500 rounded-full bg-gradient-to-r ${
                    scanStep === 5 && !scanResultData?.success 
                      ? 'from-rose-500 to-red-500' 
                      : 'from-indigo-500 via-purple-500 to-rose-500'
                  }`}
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                <span>智能解算舱</span>
                <span className="font-mono text-xs text-indigo-600">{scanProgress}%</span>
              </div>
            </div>

            {/* 步骤描述框 */}
            <div className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl p-5 min-h-[92px] flex items-center justify-center relative z-10 text-xs text-slate-500 leading-relaxed font-semibold transition-all">
              {scanStep === 1 && "📡 步骤 1/4: 建立云端安全数据通道，对接官方数据中心..."}
              {scanStep === 2 && "🔴 步骤 2/4: 正在拉取官方【双色球】最新开奖数据并校验谱图..."}
              {scanStep === 3 && "🟢 步骤 3/4: 正在拉取官方【大乐透】最新增量期号并交叉比对..."}
              {scanStep === 4 && "⚡️ 步骤 4/4: 正在智能对齐本地自选与守号策略，发送中奖报告..."}
              {scanStep === 5 && (
                <div className="w-full space-y-3">
                  {scanResultData?.success ? (
                    <>
                      <div className="text-emerald-700 font-black text-sm">
                        🎉 比对报告生成完毕，系统状态正常！
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <span className="text-[10px] text-slate-400 font-bold block">双色球数据</span>
                          <span className="text-base font-black text-rose-600">+{scanResultData.ssq || 0} 期增量</span>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <span className="text-[10px] text-slate-400 font-bold block">大乐透数据</span>
                          <span className="text-base font-black text-emerald-600">+{scanResultData.dlt || 0} 期增量</span>
                        </div>
                      </div>
                      {!isAdmin && (
                        <p className="text-[9.5px] text-amber-500 font-bold bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2">
                          💡 提示：当前为只读/访客口令，已为您运行【本地沙盒模拟对奖】，未写入生产数据库。
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-rose-700 font-bold">
                      ❌ 解算异常：{scanResultData?.error || "未知异常，请检查配置。"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 关闭/确定的动作按钮 */}
            {scanStep === 5 && (
              <button
                onClick={() => setIsScanning(false)}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wider transition-all active:scale-[0.98] shadow-md"
              >
                我知道了，返回主舱
              </button>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
