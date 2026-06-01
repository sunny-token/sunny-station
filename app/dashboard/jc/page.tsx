"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/server/client";
import { Radar, ChevronLeft, AlertCircle, Trophy, Bot, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function JcPredictPage() {
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"worldcup" | "regular">("worldcup");
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isBatchPredicting, setIsBatchPredicting] = useState(false);
  const [batchBudget, setBatchBudget] = useState("50元 (小试牛刀)");
  const [batchRisk, setBatchRisk] = useState("稳健理财 (尽量买正路保本)");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2000);
  };

  const { data: todayMatches, isLoading: isLoadingMatches, isFetching: isFetchingMatches, refetch: refetchMatches } = trpc.jc.getTodayMatches.useQuery(
    { type: mode },
    { enabled: true, retry: false, refetchOnWindowFocus: false }
  );
  const batchPredictMutation = trpc.jc.batchPredictMatches.useMutation();

  const handleRefresh = async () => {
    const result = await refetchMatches();
    if (result.status === 'success') {
      showToast(`✅ 刷新成功，拉取到 ${result.data?.length || 0} 场焦点赛事`);
    } else {
      showToast("❌ 刷新失败，请检查网络或重试");
    }
  };

  const { data: history, refetch: refetchHistory, error: queryError } = trpc.jc.getHistory.useQuery({ type: mode }, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (queryError?.data?.code === "FORBIDDEN") {
      setError("只有管理员可以访问此页面。");
    }
  }, [queryError]);

  const handleBatchPredict = async () => {
    if (!todayMatches || todayMatches.length === 0) return;
    setIsBatchPredicting(true);
    setError("");
    setBatchResult(null);
    try {
      const res = await batchPredictMutation.mutateAsync({ 
        matches: todayMatches,
        budget: batchBudget,
        risk: batchRisk,
        type: mode
      });
      setBatchResult(res);
      refetchHistory();
      showToast("🎉 扫盘完成！方案已生成");
    } catch (e: any) {
      setError(e.message || "批量预测失败");
    } finally {
      setIsBatchPredicting(false);
    }
  };

  if (error && error.includes("管理员")) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">访问被拒绝</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link href="/" className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
            返回首页
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center lg:py-10">
      <div className="w-full max-w-[430px] md:max-w-2xl lg:max-w-3xl bg-white min-h-screen lg:min-h-0 lg:rounded-[2.5rem] lg:shadow-xl lg:border lg:border-slate-100 flex flex-col relative pb-20 lg:pb-10 lg:overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Top Navigation */}
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between">
          <Link 
            href="/" 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-slate-800 text-lg tracking-tight">世界杯竞彩推演(Admin)</h1>
          <div className="w-10 h-10" />
        </div>

        <div className="px-6 md:px-12 py-6 md:py-10 space-y-8 md:space-y-12">
          
          <div className="text-center space-y-3">
            <div className="inline-flex justify-center items-center w-16 h-16 rounded-3xl bg-amber-50 border border-amber-100 text-amber-500 mb-2 shadow-sm">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              玄学赛事推演舱
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed font-light">
              不懂球也没关系！选两个听说过的国家，告诉 AI 你知道的八卦（如谁受伤了），剩下的交给玄学算法。
            </p>
          </div>

          <div className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5 md:space-y-6">
            
            <div className="flex bg-slate-50 p-1 rounded-2xl mb-2">
              <button onClick={() => setMode("worldcup")} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === "worldcup" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>🏆 世界杯专属</button>
              <button onClick={() => setMode("regular")} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === "regular" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>⚽️ 日常联赛</button>
            </div>

            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">今日焦点赛事</span>
                  <button 
                    onClick={handleRefresh} 
                    disabled={isFetchingMatches}
                    className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 hover:text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingMatches ? 'animate-spin' : ''}`} /> 
                    {isFetchingMatches ? '刷新中' : '刷新'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">打票预算</label>
                    <select 
                      value={batchBudget} 
                      onChange={e => setBatchBudget(e.target.value)} 
                      disabled={isBatchPredicting}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 text-sm font-medium disabled:opacity-50 appearance-none"
                    >
                      <option value="50元 (小试牛刀)">50元 (小试牛刀)</option>
                      <option value="100元 (赚顿饭钱)">100元 (赚顿饭钱)</option>
                      <option value="500元 (中等投入)">500元 (中等投入)</option>
                      <option value="1000元以上 (重注)">1000元+ (重注)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">风险偏好</label>
                    <select 
                      value={batchRisk} 
                      onChange={e => setBatchRisk(e.target.value)}
                      disabled={isBatchPredicting}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 text-sm font-medium disabled:opacity-50 appearance-none"
                    >
                      <option value="稳健理财 (尽量买正路保本)">稳健理财 (保本防冷)</option>
                      <option value="均衡配置 (正路+博冷)">均衡配置 (正路+博冷)</option>
                      <option value="放手一搏 (全搏冷门高赔)">放手一搏 (博冷门高赔)</option>
                    </select>
                  </div>
                </div>

                {isLoadingMatches ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />)}
                  </div>
                ) : todayMatches?.length ? (
                  <div className="space-y-3">
                    {todayMatches.map((m: any, idx: number) => (
                      <div key={m.matchId || m.matchNumStr || idx} className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold mb-0.5">{m.matchNumStr} {m.league}</span>
                          <span className="text-sm font-black text-slate-700">{m.homeTeam} <span className="text-slate-300 mx-1 text-xs">VS</span> {m.awayTeam}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-md">{m.matchTime ? m.matchTime.slice(0, 5) : ""}</span>
                      </div>
                    ))}
                    <button
                      onClick={handleBatchPredict}
                      disabled={isBatchPredicting}
                      className={`w-full py-4 mt-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                        isBatchPredicting 
                          ? "bg-indigo-300 cursor-not-allowed shadow-none" 
                          : "bg-gradient-to-r from-indigo-500 to-blue-500 hover:opacity-90 shadow-indigo-200"
                      }`}
                    >
                      {isBatchPredicting ? "🤖 正在多线程智能扫盘中..." : "🤖 一键扫盘并出今日总单"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-sm font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">今日暂无可分析的竞彩赛事</div>
                )}
            </div>
          </div>

          {error && !error.includes("管理员") && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600 leading-relaxed font-medium">{error}</p>
            </div>
          )}

          {isBatchPredicting && (
            <div className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center justify-center text-center overflow-hidden relative animate-in fade-in zoom-in-95 duration-500 min-h-[220px]">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent" />
              <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-2 border border-indigo-500/40 rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 via-indigo-500/20 to-indigo-500/40 origin-center animate-spin" />
                <div className="relative z-10 bg-slate-800 p-3 rounded-full shadow-lg border border-slate-700">
                  <Radar className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-wide">
                AI 赛事网络推演中
              </h3>
              <p className="text-xs text-indigo-200 font-medium">
                正在分析近期交锋与状态数据...
              </p>
            </div>
          )}

          {batchResult && !isBatchPredicting && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 px-1 mb-4">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <h3 className="font-bold text-slate-800 text-lg">今日终极总答案</h3>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 rounded-3xl p-6 border border-indigo-100/60 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/40 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 mb-5 border border-indigo-100 shadow-sm">
                    <h4 className="font-black text-indigo-600 mb-2 flex items-center gap-2"><Bot className="w-4 h-4"/> 宏观策略概览</h4>
                    <p className="text-slate-800 font-bold leading-relaxed">{batchResult.summary}</p>
                    
                    {(batchResult.ticketPlan || batchResult.purchaseTime) && (
                      <div className="mt-4 pt-4 border-t border-indigo-100/50 space-y-3">
                        {batchResult.ticketPlan && (
                          <div className="flex flex-col">
                            <span className="text-[10px] text-indigo-400 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">🎫 核心打票方案 (小白直接抄)</span>
                            <span className="text-sm font-black text-slate-800 bg-indigo-50/80 px-3 py-2 rounded-xl border border-indigo-100">{batchResult.ticketPlan}</span>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3">
                          {batchResult.estimatedCost && (
                            <div className="flex flex-col bg-white rounded-xl p-3 border border-indigo-50 shadow-sm">
                              <span className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">💰 预计成本</span>
                              <span className="text-sm font-black text-slate-700">{batchResult.estimatedCost}</span>
                            </div>
                          )}
                          {batchResult.expectedReturn && (
                            <div className="flex flex-col bg-white rounded-xl p-3 border border-indigo-50 shadow-sm">
                              <span className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">🏆 预计中奖金额</span>
                              <span className="text-sm font-black text-rose-500">{batchResult.expectedReturn}</span>
                            </div>
                          )}
                        </div>
                        
                        {batchResult.purchaseTime && (
                          <div className="flex items-center gap-2 bg-amber-50/80 p-3 rounded-xl border border-amber-100/50 mt-1">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="text-xs font-bold text-amber-700">{batchResult.purchaseTime}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {batchResult.matches?.map((m: any, idx: number) => (
                      <div key={idx} className="bg-white/60 rounded-2xl p-4 border border-indigo-50 hover:bg-white transition-colors">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold text-white bg-indigo-400 px-2 py-0.5 rounded-full shadow-sm">{m.matchNumStr}</span>
                          <span className="text-sm font-black text-slate-800">{m.homeTeam} <span className="text-slate-300 mx-1 text-[10px]">VS</span> {m.awayTeam}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="text-center bg-indigo-50/50 rounded-xl p-2 border border-indigo-50">
                            <span className="text-[10px] text-slate-400 block mb-1 font-bold">走势预测</span>
                            <span className="text-base font-black text-amber-600">{m.result}</span>
                          </div>
                          <div className="text-center bg-indigo-50/50 rounded-xl p-2 border border-indigo-50">
                            <span className="text-[10px] text-slate-400 block mb-1 font-bold">参考比分</span>
                            <span className="text-base font-black text-rose-500">{m.score}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50/50 p-2.5 rounded-xl">🧠 {m.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          <div className="border-t border-slate-100 pt-8 space-y-5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-amber-500 rounded-full" />
                <h3 className="font-bold text-slate-800 text-lg">历史足迹</h3>
              </div>
            </div>

            {!history ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div key={n} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.01)] animate-pulse h-32" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-10 text-center border border-dashed border-slate-200">
                <p className="text-sm text-slate-400 font-light">暂无历史测算记录</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((pred: any) => {
                  const p = typeof pred.prediction === "string" ? JSON.parse(pred.prediction) : pred.prediction;
                  return (
                    <div key={pred.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-500">
                            {new Date(pred.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">
                            {pred.awayTeam === "worldcup" ? "🏆 世界杯专属扫盘" : "⚽️ 日常联赛扫盘"}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-indigo-50/50 rounded-xl p-3 mb-3">
                        <span className="text-[10px] font-bold text-indigo-400 block mb-1">宏观策略概览</span>
                        <span className="font-bold text-slate-700 text-xs leading-relaxed">{p.summary}</span>
                        {p.ticketPlan && (
                          <div className="mt-2 pt-2 border-t border-indigo-100/50">
                            <span className="text-[10px] font-bold text-indigo-400 block mb-1">核心打票方案</span>
                            <span className="font-black text-slate-800 text-xs block bg-white px-2 py-1 rounded-md border border-indigo-50">{p.ticketPlan}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {p.matches?.slice(0, 3).map((m: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-bold text-slate-600">{m.homeTeam} <span className="text-[10px] text-slate-400">vs</span> {m.awayTeam}</span>
                            <div className="flex gap-2">
                              <span className="text-amber-600 font-bold">{m.result}</span>
                              <span className="text-rose-500 font-bold">{m.score}</span>
                            </div>
                          </div>
                        ))}
                        {p.matches?.length > 3 && (
                          <div className="text-center text-[10px] text-slate-400 font-bold mt-2">
                            ... 等 {p.matches.length} 场赛事推演
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 精美 Custom Toast 提示 */}
        {toastMessage && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-800/90 backdrop-blur-md text-white text-sm font-medium rounded-full shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            {toastMessage}
          </div>
        )}
      </div>
    </main>
  );
}
