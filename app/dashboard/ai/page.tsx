"use client";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/server/client";
import { Radar, ChevronLeft, Sparkles, AlertCircle, ChevronDown } from "lucide-react";
import Link from "next/link";
import LotteryNumbersInput from "@/components/LotteryNumbersInput";

export default function AiPredictPage() {
  const [lotteryType, setLotteryType] = useState<"ssq" | "dlt">("ssq");
  const [isPredicting, setIsPredicting] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState("");
  const [predictedNumbers, setPredictedNumbers] = useState<{ red: string[]; blue: string[]; reason?: string }[] | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const { data: history, refetch: refetchHistory } = trpc.ai.getPredictionHistory.useQuery({
    type: lotteryType
  });

  const predictNumbersMutation = trpc.ai.predictNumbers.useMutation();

  // 模拟雷达加载动画进度
  useEffect(() => {
    if (!isPredicting) return;
    
    setScanStep(1);
    setScanProgress(15);
    
    const t1 = setTimeout(() => {
      setScanStep(2);
      setScanProgress(45);
    }, 800);
    
    const t2 = setTimeout(() => {
      setScanStep(3);
      setScanProgress(75);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isPredicting]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2000);
  };

  const handleCopyCombo = (combo: { red: string[]; blue: string[] }) => {
    const text = `${combo.red.join(" ")} | ${combo.blue.join(" ")}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast("📋 号码复制成功！");
    }).catch(() => {
      showToast("❌ 复制失败，请重试");
    });
  };

  const handleCopyAll = (combos: { red: string[]; blue: string[] }[]) => {
    const text = combos.map(combo => `${combo.red.join(" ")} | ${combo.blue.join(" ")}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      showToast("📋 全部 5 注推荐号码已复制！");
    }).catch(() => {
      showToast("❌ 复制失败，请重试");
    });
  };

  const isRequestingRef = useRef(false);

  const handleStartPredict = async () => {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;

    setError("");
    setPredictedNumbers(null);
    setIsPredicting(true);
    
    try {
      const res = await predictNumbersMutation.mutateAsync({ type: lotteryType });
      
      // 动画补全
      setScanStep(4);
      setScanProgress(100);
      
      setTimeout(() => {
        setPredictedNumbers(res);
        setIsPredicting(false);
        setScanStep(0);
        setScanProgress(0);
        refetchHistory(); // 刷新预测足迹记录
        isRequestingRef.current = false;
      }, 600);
      
    } catch (e: any) {
      setError(e.message || "AI 预测过程发生异常，请稍后重试");
      setIsPredicting(false);
      setScanStep(0);
      setScanProgress(0);
      isRequestingRef.current = false;
    }
  };

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
          <h1 className="font-bold text-slate-800 text-lg tracking-tight">AI 智能测号中心</h1>
          <div className="w-10 h-10" /> {/* 占位符以居中标题 */}
        </div>

        <div className="px-6 md:px-12 py-6 md:py-10 space-y-8 md:space-y-12">
          
          {/* Hero Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex justify-center items-center w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-500 mb-2 shadow-sm">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              基于深度学习的测算
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed font-light">
              AI 模型将分析最近 100 期的历史中奖图谱，结合概率网络，为您智能推演 5 注最有潜力的号码组合。
            </p>
          </div>

          {/* Configuration Card */}
          <div className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5 md:space-y-6">
            <div className="space-y-3">
              <label className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">选择分析彩种</label>
              <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                <button
                  onClick={() => setLotteryType("ssq")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    lotteryType === "ssq" ? "bg-white text-rose-500 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  双色球
                </button>
                <button
                  onClick={() => setLotteryType("dlt")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    lotteryType === "dlt" ? "bg-white text-emerald-500 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  大乐透
                </button>
              </div>
            </div>

            <button
              onClick={handleStartPredict}
              disabled={isPredicting}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                isPredicting 
                  ? "bg-indigo-300 cursor-not-allowed" 
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 shadow-indigo-200"
              }`}
            >
              {isPredicting ? "雷达解算中..." : "启动 AI 雷达推演"}
            </button>
          </div>

          {/* Feedback & Error States */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600 leading-relaxed font-medium">{error}</p>
            </div>
          )}

          {isPredicting && (
            <div className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center justify-center text-center overflow-hidden relative animate-in fade-in zoom-in-95 duration-500 min-h-[220px] md:min-h-[280px]">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent" />
              
              <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-2 border border-indigo-500/40 rounded-full" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-indigo-500/20" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-indigo-500/20" />
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 via-indigo-500/20 to-indigo-500/40 origin-center animate-spin" style={{ animationDuration: '1.5s' }} />
                <div className="relative z-10 bg-slate-800 p-3 rounded-full shadow-lg border border-slate-700">
                  <Radar className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-2 tracking-wide">
                AI 深度学习 network 推演中
              </h3>
              
              <div className="h-6 mb-4">
                <p className="text-xs text-indigo-200 font-medium transition-all">
                  {scanStep === 1 && "正在检索最近 100 期开奖历史图谱..."}
                  {scanStep === 2 && "正在建立马尔可夫链与概率权重矩阵..."}
                  {scanStep === 3 && "正在生成最具潜力的 5 注号码组合..."}
                  {scanStep === 4 && "测算完毕，正在装载数据..."}
                </p>
              </div>

              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Section */}
          {!isPredicting && predictedNumbers && predictedNumbers.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                  <h3 className="font-bold text-slate-800 text-lg">智能推荐组合 ({predictedNumbers.length}注)</h3>
                </div>
                <button
                  onClick={() => handleCopyAll(predictedNumbers)}
                  className="text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 px-4 py-2 rounded-xl transition-all active:scale-[0.95] shadow-sm shadow-indigo-100 flex items-center gap-1 cursor-pointer"
                >
                  一键复制全部 5 注
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictedNumbers.map((combo, index) => (
                  <div key={index} className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                        推演组合 {index + 1}
                      </span>
                      <button
                        onClick={() => handleCopyCombo(combo)}
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full border border-indigo-100/50 transition-all active:scale-[0.95] flex items-center gap-1 cursor-pointer"
                      >
                        复制本注
                      </button>
                    </div>
                    <LotteryNumbersInput
                      lotteryType={lotteryType}
                      redNumbers={combo.red}
                      blueNumbers={combo.blue}
                      onChange={() => {}}
                      disabled={true}
                    />
                    {combo.reason && (
                      <div className="mt-1 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-bold text-indigo-500 mr-1.5">🧠 核心逻辑:</span>
                          {combo.reason}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 历史预测足迹板块 */}
          <div className="border-t border-slate-100 pt-8 space-y-5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <h3 className="font-bold text-slate-800 text-lg">AI 历史预测足迹</h3>
              </div>
              <span className="text-xs text-slate-400 font-light">最近 10 次测算记录</span>
            </div>

            {/* 骨架屏加载状态 */}
            {!history ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.01)] animate-pulse space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-28 bg-slate-100 rounded-full" />
                      <div className="h-4 w-16 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-20 w-full bg-slate-100 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-10 text-center border border-dashed border-slate-200">
                <p className="text-sm text-slate-400 font-light">暂无 AI 历史预测足迹，赶快点击测算一次吧！</p>
              </div>
            ) : (
              <div className="space-y-6">
                {history.slice(0, 10).map((pred: any) => {
                  const combos = typeof pred.predictedNumbers === "string" 
                    ? JSON.parse(pred.predictedNumbers) 
                    : pred.predictedNumbers;
                  const hits = pred.hitDetail 
                    ? (typeof pred.hitDetail === "string" ? JSON.parse(pred.hitDetail) : pred.hitDetail) 
                    : null;

                  const hasWon = hits && hits.some((h: any) => h.isWinner);
                  const isExpanded = expandedMap[pred.id] || false;

                  return (
                    <div 
                      key={pred.id} 
                      className={`bg-white rounded-3xl p-5 md:p-6 border transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${
                        pred.status === "PENDING"
                          ? "border-amber-100 bg-gradient-to-r from-white to-amber-50/5 shadow-amber-50/5"
                          : hasWon
                            ? "border-emerald-100 bg-gradient-to-r from-white to-emerald-50/5"
                            : "border-slate-100"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start gap-2 mb-4 pb-3 border-b border-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${
                              pred.lotteryType === "ssq" 
                                ? "bg-rose-50 text-rose-500 border-rose-100" 
                                : "bg-emerald-50 text-emerald-500 border-emerald-100"
                            }`}>
                              {pred.lotteryType === "ssq" ? "双色球" : "大乐透"}
                            </span>
                            <span className="text-sm font-extrabold text-slate-700">
                              第 {pred.issueNumber} 期 推演预测
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1 pl-0.5 font-light">
                            测算：{new Date(pred.createdAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>

                        {/* Status Badge */}
                        {pred.status === "PENDING" ? (
                          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                            等待开奖
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-400 px-3 py-1 rounded-full text-xs font-bold">
                            已开奖
                          </div>
                        )}
                      </div>

                      {/* Toggle & Summary */}
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm font-medium text-slate-500">
                          {hasWon ? "🎉 包含中奖号码" : "生成了 5 注号码"}
                        </span>
                        <button 
                          onClick={() => toggleExpand(pred.id)}
                          className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {isExpanded ? "收起详情" : "查看详情"}
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          {/* Number Combos List */}
                          <div className="space-y-3 mt-4">
                        {combos.map((combo: any, cIdx: number) => {
                          const hit = hits?.[cIdx];
                          return (
                            <div 
                              key={cIdx} 
                              className={`p-3 rounded-2xl border transition-all ${
                                hit?.isWinner 
                                  ? "bg-emerald-50/40 border-emerald-100/50" 
                                  : "bg-slate-50/50 border-slate-100/30"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-0.5">
                                <span className="text-[10px] font-bold text-slate-400">
                                  推荐组合 {cIdx + 1}
                                </span>
                                {pred.status === "OPENED" && hit && (
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    hit.isWinner
                                      ? "bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-50"
                                      : "text-slate-400"
                                  }`}>
                                    {hit.isWinner ? `🎉 中奖！${hit.prize} (${hit.redHit}+${hit.blueHit})` : `未中奖 (${hit.redHit}+${hit.blueHit})`}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Red Balls */}
                                {combo.red.map((num: string, nIdx: number) => (
                                  <span 
                                    key={nIdx} 
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-xs font-bold shadow-sm"
                                  >
                                    {num}
                                  </span>
                                ))}
                                <span className="text-slate-300 mx-0.5 text-sm font-light">|</span>
                                {/* Blue Balls */}
                                {combo.blue.map((num: string, nIdx: number) => (
                                  <span 
                                    key={nIdx} 
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-50 text-blue-500 border border-blue-100 text-xs font-bold shadow-sm"
                                  >
                                    {num}
                                  </span>
                                ))}

                                <button
                                  onClick={() => handleCopyCombo(combo)}
                                  className="ml-auto w-6.5 h-6.5 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-400 hover:text-indigo-500 transition-all active:scale-[0.9] cursor-pointer"
                                  title="复制此注"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Display Open Numbers for comparison when status is OPENED */}
                      {pred.status === "OPENED" && pred.openNumbers && (
                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-3">
                          <span className="text-xs font-black text-slate-400 shrink-0">真实开奖：</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {((pred.openNumbers as any).red || []).map((num: string, nIdx: number) => (
                              <span key={nIdx} className="w-5.5 h-5.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-black shadow-sm">
                                {num}
                              </span>
                            ))}
                            <span className="text-slate-300 mx-0.5 text-xs font-light">|</span>
                            {/* Blue */}
                            {Array.isArray((pred.openNumbers as any).blue) 
                              ? (pred.openNumbers as any).blue.map((num: string, nIdx: number) => (
                                  <span key={nIdx} className="w-5.5 h-5.5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-black shadow-sm">
                                    {num}
                                  </span>
                                ))
                              : <span className="w-5.5 h-5.5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-black shadow-sm">{(pred.openNumbers as any).blue}</span>
                            }
                          </div>
                        </div>
                      )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* 精美 Custom Toast 提示 */}
        {toastMessage && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-white text-xs md:text-sm font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            {toastMessage}
          </div>
        )}

      </div>
    </main>
  );
}

