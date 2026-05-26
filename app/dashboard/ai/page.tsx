"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/server/client";
import { Radar, ChevronLeft, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";
import LotteryNumbersInput from "@/components/LotteryNumbersInput";

export default function AiPredictPage() {
  const [lotteryType, setLotteryType] = useState<"ssq" | "dlt">("ssq");
  const [isPredicting, setIsPredicting] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState("");
  const [predictedNumbers, setPredictedNumbers] = useState<{red: string[], blue: string[]}[] | null>(null);

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

  const handleStartPredict = async () => {
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
      }, 600);
      
    } catch (e: any) {
      setError(e.message || "AI 预测过程发生异常，请稍后重试");
      setIsPredicting(false);
      setScanStep(0);
      setScanProgress(0);
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

        <div className="px-6 md:px-12 py-6 md:py-10 space-y-6 md:space-y-8">
          
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
                AI 深度学习网络推演中
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
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <h3 className="font-bold text-slate-800 text-lg">智能推荐组合 ({predictedNumbers.length}注)</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictedNumbers.map((combo, index) => (
                  <div key={index} className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                        推演组合 {index + 1}
                      </span>
                    </div>
                    <LotteryNumbersInput
                      lotteryType={lotteryType}
                      redNumbers={combo.red}
                      blueNumbers={combo.blue}
                      onChange={() => {}}
                      disabled={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
