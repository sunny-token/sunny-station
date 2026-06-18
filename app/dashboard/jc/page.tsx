"use client";
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/server/client";
import { Radar, ChevronLeft, AlertCircle, Trophy, Bot, RefreshCw, ExternalLink, X, Upload, Trash2 } from "lucide-react";
import Link from "next/link";

const getOddsFromMatchAndResult = (match: any, result: string): string => {
  if (!match) return "";
  const resText = result.trim();

  // 1. 让球胜平负 (包含“让”字)
  if (resText.includes("让")) {
    if (!match.hhad) return "";
    if (resText.includes("胜")) return match.hhad.h || "";
    if (resText.includes("平")) return match.hhad.d || "";
    if (resText.includes("负")) return match.hhad.a || "";
  }

  // 2. 胜平负 (不包含“让”字)
  if (resText.includes("胜") || resText.includes("平") || resText.includes("负")) {
    // 半全场判断，如“平胜”、“胜平”、“胜胜”（长度通常为2）
    const cleanText = resText.replace(/(推荐|走势预测|推荐的|让)/g, "").trim();
    if (cleanText.length === 2 && ["胜", "平", "负"].includes(cleanText[0]) && ["胜", "平", "负"].includes(cleanText[1])) {
      if (!match.hafu) return "";
      const mapping: Record<string, string> = { "胜": "h", "平": "d", "负": "a" };
      const key = (mapping[cleanText[0]] || "") + (mapping[cleanText[1]] || "");
      return match.hafu[key] || "";
    }

    if (match.had) {
      if (resText.includes("胜")) return match.had.h || "";
      if (resText.includes("平")) return match.had.d || "";
      if (resText.includes("负")) return match.had.a || "";
    }
  }

  // 3. 比分 (形如“2:1”或“0-0”)
  const scoreMatch = resText.match(/(\d+)\s*[:：-]\s*(\d+)/);
  if (scoreMatch && match.crs) {
    const home = scoreMatch[1].padStart(2, "0");
    const away = scoreMatch[2].padStart(2, "0");
    const key = `${home}${away}`;
    return match.crs[key] || match.crs[`_${key}`] || "";
  }

  // 4. 总进球 (进球数)
  const goalMatch = resText.match(/(总进球|进球|球)\s*(\d+)/) || resText.match(/^(\d+)球$/);
  if (goalMatch && match.ttg) {
    const goals = goalMatch[goalMatch.length - 1];
    const key = `s${goals}`;
    return match.ttg[key] || "";
  }

  return "";
};

export default function JcPredictPage() {
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"worldcup" | "regular" | "champion">("worldcup");
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isBatchPredicting, setIsBatchPredicting] = useState(false);
  const [batchBudget, setBatchBudget] = useState("10元 (买包烟)");
  const [batchRisk, setBatchRisk] = useState("均衡配置 (正路+博冷)");
  const [toastMessage, setToastMessage] = useState("");
  const [customRules, setCustomRules] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRules = localStorage.getItem("jc_custom_rules") || "";
      setCustomRules(savedRules);
    }
  }, []);

  const handleRulesChange = (val: string) => {
    setCustomRules(val);
    localStorage.setItem("jc_custom_rules", val);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2000);
  };

  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isFetchingMatches, setIsFetchingMatches] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [matchDates, setMatchDates] = useState<string[]>([]);
  const [allRegularMatches, setAllRegularMatches] = useState<any[]>([]);

  const fetchMatchesClient = useCallback(async () => {
    setIsLoadingMatches(true);
    setIsFetchingMatches(true);
    try {
      if (mode === "champion") {
        const chpRes = await fetch(`https://webapi.sporttery.cn/gateway/jc/tournament/getTournCalculatorV1.qry?poolCode=CHP&sportsCode=FB&tCode=WCC&channel=c`);
        const fnlRes = await fetch(`https://webapi.sporttery.cn/gateway/jc/tournament/getTournCalculatorV1.qry?poolCode=FNL&sportsCode=FB&tCode=WCC&channel=c`);
        if (!chpRes.ok || !fnlRes.ok) throw new Error("获取冠军赛事失败");
        const chpData = await chpRes.json();
        const fnlData = await fnlRes.json();
        
        const chpList = chpData?.value?.list || [];
        const fnlList = fnlData?.value?.list || [];
        
        const formattedChp = chpList.map((m: any) => ({
          matchId: `CHP_${m.selectionNum}`,
          matchNumStr: `冠军(0${m.selectionNum})`,
          league: "世界杯冠军",
          homeTeam: m.homeTeamCnName,
          awayTeam: m.awayTeamCnName || "",
          matchTime: m.saleStatus === 1 ? '在售' : '停售',
          saleStatus: m.saleStatus,
          odds: m.odds,
          poolCode: 'CHP'
        }));
        
        const formattedFnl = fnlList.map((m: any) => ({
          matchId: `FNL_${m.selectionNum}`,
          matchNumStr: `冠亚军(0${m.selectionNum})`,
          league: "世界杯冠亚军",
          homeTeam: m.homeTeamCnName,
          awayTeam: m.awayTeamCnName || "",
          matchTime: m.saleStatus === 1 ? '在售' : '停售',
          saleStatus: m.saleStatus,
          odds: m.odds,
          poolCode: 'FNL'
        }));
        
        const allChampMatches = [...formattedChp, ...formattedFnl].filter((m: any) => m.odds);
        const matches = allChampMatches.slice(0, 50);
        setError("");
        setTodayMatches(matches);
        return { status: 'success', data: matches };
      } else {
        const res = await fetch(`https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=hhad,had,crs,hafu,ttg&channel=c`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (!json?.value?.matchInfoList) {
          const vtools = json?.value?.vtoolsConfig;
          if (vtools && (vtools.offLineSaleStatus === 1 || vtools.onLineSaleStatus === 1)) {
            setError(`当前为体彩休市时间（工作日通常11:00开售，周末10:00）。官方提示：${vtools.offLineStopMessage || '本彩种已停止销售'}`);
          }
          setTodayMatches([]);
          setAllRegularMatches([]);
          setMatchDates([]);
          return { status: 'success', data: [] };
        }
        
        setError(""); // Clear error if matches are successfully loaded

        const allMatches = json.value.matchInfoList.flatMap((group: any) => {
          return (group.subMatchList || []).map((m:any) => ({...m, businessDate: group.businessDate}));
        });
        
        setAllRegularMatches(allMatches);

        return { status: 'success', data: allMatches };
      }
    } catch (e: any) {
      console.error("Client fetch error:", e);
      setError(e.message || "获取赛事失败");
      return { status: 'error' };
    } finally {
      setIsLoadingMatches(false);
      setIsFetchingMatches(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchMatchesClient();
  }, [fetchMatchesClient]);

  useEffect(() => {
    if (mode === "champion") return;
    
    // First, filter by mode (World Cup vs Regular)
    const modeFilteredMatches = allRegularMatches.filter((m: any) => {
      if (m.matchStatus !== "Selling" || m.sellStatus === 2) return false;
      const league = m.leagueAbbName || "";
      const isWorldCup = league.includes("世界杯") || league.includes("世预") || league.includes("世亚预") || league.includes("世欧预");
      return mode === "worldcup" ? isWorldCup : !isWorldCup;
    });

    // Compute dynamic dates based on the current mode's matches
    const dates = Array.from(new Set(modeFilteredMatches.map((m: any) => m.businessDate))).filter(Boolean) as string[];
    setMatchDates(dates);
    
    // If selectedDate is not in the new dates list, reset to "all"
    setSelectedDate(prev => (!dates.includes(prev) && prev !== "all") ? "all" : prev);

    // Then, filter by the selected date
    const finalFiltered = modeFilteredMatches.filter((m: any) => {
      // If we are evaluating the current render, use the updated selectedDate logically
      // But since setState is async, we'll just check if it's valid
      const effectiveDate = (!dates.includes(selectedDate) && selectedDate !== "all") ? "all" : selectedDate;
      if (effectiveDate !== "all" && m.businessDate !== effectiveDate) return false;
      return true;
    });
    
    const matches = finalFiltered.map((m: any) => ({
      matchId: m.matchId,
      matchNumStr: m.matchNumStr,
      league: m.leagueAbbName,
      homeTeam: m.homeTeamAbbName,
      awayTeam: m.awayTeamAbbName,
      matchTime: m.matchTime,
      homeRank: m.homeRank,
      awayRank: m.awayRank,
      had: m.had,
      hhad: m.hhad,
      crs: m.crs,
      hafu: m.hafu,
      ttg: m.ttg,
      businessDate: m.businessDate,
    })).slice(0, 50);
    
    setTodayMatches(matches);
  }, [allRegularMatches, mode, selectedDate]);

  const calculatePrizeMutation = trpc.jc.calculatePrizeWithAI.useMutation();
  const [calculatingPredId, setCalculatingPredId] = useState<number | null>(null);
  const [calcImage, setCalcImage] = useState<string>("");
  const [calcOddsList, setCalcOddsList] = useState<{label: string, value: string}[]>([]);
  const [calcResult, setCalcResult] = useState<any>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCalcImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCalculatePrize = async () => {
    if (!calculatingPredId || !calcImage) return showToast("请先上传赛果截图");
    setCalcResult(null);
    
    const oddsText = calcOddsList.map(item => `${item.label}赔率: ${item.value}`).join("\n");

    try {
      const res = await calculatePrizeMutation.mutateAsync({
        id: calculatingPredId,
        base64Image: calcImage,
        oddsText: oddsText
      });
      setCalcResult(res);
      
      // Auto save result
      await updateResultMutation.mutateAsync({ 
        id: calculatingPredId, 
        actualResult: JSON.stringify({ 
          isHit: res.isHit, 
          checkedAt: new Date().toISOString(),
          analysisReasoning: res.analysisReasoning
        }),
        prizeAmount: res.prizeAmount,
        status: "FINISHED"
      });
      refetchHistory();
    } catch (err: any) {
      showToast(err.message || "算奖失败");
    }
  };

  const handleApplyCalcResult = async () => {
    if (!calculatingPredId || !calcResult) return;
    showToast(calcResult.isHit ? "🎯 已记录为红单！" : "📝 已记录为黑单");
    closeCalcModal();
  };

  const handleOpenCalcModal = (pred: any) => {
    setCalculatingPredId(pred.id);
    const p = typeof pred.prediction === "string" ? JSON.parse(pred.prediction) : pred.prediction;
    
    if (p.matches && Array.isArray(p.matches)) {
      const howToBuy = p.howToBuy || "";
      let filteredMatches = p.matches;
      if (howToBuy) {
        // howToBuy 中可能是 "004胜"，所以我们只匹配这3个数字来找场次
        filteredMatches = p.matches.filter((m: any) => {
          const matchNum = m.matchNumStr.replace(/[^0-9]/g, '');
          return howToBuy.includes(matchNum);
        });
      }
      if (filteredMatches.length === 0) {
        filteredMatches = p.matches;
      }
      const initialOdds = filteredMatches.map((m: any) => {
        // 优先从历史保存数据中取，若没有再匹配今日列表最新的
        let matchedMatch = m;
        if (!m.had && !m.hhad) {
          const found = todayMatches.find((tm: any) => tm.matchNumStr === m.matchNumStr || (tm.homeTeam === m.homeTeam && tm.awayTeam === m.awayTeam));
          if (found) {
            matchedMatch = { ...m, ...found };
          }
        }
        
        const defaultOdds = getOddsFromMatchAndResult(matchedMatch, m.result);

        return {
          label: `${m.matchNumStr} ${m.result}`,
          value: defaultOdds
        };
      });
      setCalcOddsList(initialOdds);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!calculatingPredId) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setCalcImage(reader.result as string);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [calculatingPredId]);

  const closeCalcModal = () => {
    setCalculatingPredId(null);
    setCalcImage("");
    setCalcOddsList([]);
    setCalcResult(null);
  };

  const handleRefresh = async () => {
    const result = await fetchMatchesClient();
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

  const updateResultMutation = trpc.jc.updateResult.useMutation();
  const deletePredictionMutation = trpc.jc.deletePrediction.useMutation();
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("⚠️ 确定要删除这条推演历史记录吗？删除后将无法恢复。")) return;
    try {
      await deletePredictionMutation.mutateAsync({ id });
      showToast("🗑️ 记录已成功删除");
      refetchHistory();
    } catch (err: any) {
      showToast(err.message || "删除失败");
    }
  };

  const batchPredictMutation = trpc.jc.batchPredictMatches.useMutation();
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
        type: mode,
        rules: customRules
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
              <button onClick={() => { setMode("worldcup"); setBatchResult(null); }} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === "worldcup" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>🏆 世界杯专属</button>
              <button onClick={() => { setMode("regular"); setBatchResult(null); }} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === "regular" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>⚽️ 日常联赛</button>
              <button onClick={() => { setMode("champion"); setBatchResult(null); }} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === "champion" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>🥇 冠军竞猜</button>
            </div>

            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{mode === 'champion' ? '焦点赛事' : '比赛日程'}</span>
                  <button 
                    onClick={handleRefresh} 
                    disabled={isFetchingMatches}
                    className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 hover:text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingMatches ? 'animate-spin' : ''}`} /> 
                    {isFetchingMatches ? '刷新中' : '刷新'}
                  </button>
                </div>

                {mode !== 'champion' && matchDates.length > 0 && (
                  <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                    <button
                      onClick={() => setSelectedDate("all")}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedDate === "all" ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                    >
                      全部日期
                    </button>
                    {matchDates.map(date => (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedDate === date ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">打票预算</label>
                    <select 
                      value={batchBudget} 
                      onChange={e => setBatchBudget(e.target.value)} 
                      disabled={isBatchPredicting}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 text-sm font-medium disabled:opacity-50 appearance-none"
                    >
                      <option value="10元 (买包烟)">10元 (买包烟)</option>
                      <option value="50元 (小试牛刀)">50元 (小试牛刀)</option>
                      <option value="100元 (赚顿饭钱)">100元 (赚顿饭钱)</option>
                      <option value="500元 (中等投入)">500元 (中等投入)</option>
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">自定义出号规则 (选填)</label>
                  <textarea 
                    value={customRules} 
                    onChange={e => handleRulesChange(e.target.value)}
                    disabled={isBatchPredicting}
                    placeholder="例如：过滤掉让球超过2球的比赛、尽量推2串1、优先考虑赔率在1.5到2.5之间的选项..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 text-sm font-medium disabled:opacity-50 resize-none placeholder-slate-400"
                  />
                </div>

                {isLoadingMatches ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />)}
                  </div>
                ) : todayMatches?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">编号</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">赛事</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">主队/选项</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">客队/赔率</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">开赛时间</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {todayMatches.map((m: any, idx: number) => (
                          <tr key={m.matchId || m.matchNumStr || idx}>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-400">{m.matchNumStr}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{m.league}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800">{m.homeTeam}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">{mode !== 'champion' && m.awayTeam ? 'vs' : ''}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800">{m.awayTeam} {m.odds ? <span className="text-orange-500 ml-1">赔率: {m.odds}</span> : ''}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                              {mode === 'champion' ? "-" : (m.matchTime ? m.matchTime.slice(0, 5) : "")}
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap text-xs font-bold ${mode === 'champion' && m.saleStatus !== 0 ? 'text-slate-400' : 'text-emerald-500'}`}>
                              {mode === 'champion' ? (m.saleStatus === 0 ? '在售' : '停售') : '在售'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-sm font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200 mb-3">今日暂无可分析的赛事（或全部处于暂停销售状态）</div>
                )}
                <button
                  onClick={handleBatchPredict}
                  disabled={isBatchPredicting || !todayMatches?.length}
                  className={`w-full py-4 mt-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                    isBatchPredicting || !todayMatches?.length
                      ? "bg-indigo-300 cursor-not-allowed shadow-none" 
                      : "bg-gradient-to-r from-indigo-500 to-blue-500 hover:opacity-90 shadow-indigo-200"
                  }`}
                >
                  {isBatchPredicting ? "🤖 正在多线程智能扫盘中..." : "🤖 一键扫盘并出今日总单"}
                </button>
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
                  {/* 怎么买 - 直接发给老板 */}
                  {batchResult.howToBuy && (
                    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 mb-4 border-2 border-indigo-400 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.3)]">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-black text-indigo-600 flex items-center gap-2 text-base"><Bot className="w-5 h-5"/> 怎么买 (直接发给老板)</h4>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(batchResult.howToBuy); showToast("✅ 复制成功，快去发给老板吧！"); }} 
                          className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors shadow-sm active:scale-95"
                        >
                          一键复制
                        </button>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl font-bold text-[15px] leading-relaxed relative">
                        {/* Chat bubble tail */}
                        <div className="absolute -left-1.5 top-4 w-3 h-3 bg-emerald-50 rotate-45 border-l border-b border-emerald-200"></div>
                        <p className="relative z-10">{batchResult.howToBuy}</p>
                      </div>
                    </div>
                  )}

                  {/* 什么时候买 */}
                  {batchResult.whenToBuy && (
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 mb-4 border border-indigo-100 shadow-sm flex items-start gap-3">
                      <div className="bg-amber-100 p-2.5 rounded-xl shrink-0"><AlertCircle className="w-5 h-5 text-amber-600"/></div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1 tracking-wide">什么时候买</h4>
                        <p className="text-slate-600 font-semibold text-sm leading-relaxed">{batchResult.whenToBuy}</p>
                      </div>
                    </div>
                  )}

                  {/* 为什么买 */}
                  {batchResult.whyToBuy && (
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 mb-5 border border-indigo-100 shadow-sm flex items-start gap-3">
                      <div className="bg-blue-100 p-2.5 rounded-xl shrink-0"><Trophy className="w-5 h-5 text-blue-600"/></div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1 tracking-wide">为什么买</h4>
                        <p className="text-slate-600 font-semibold text-sm leading-relaxed">{batchResult.whyToBuy}</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {batchResult.matches?.map((m: any, idx: number) => (
                      <div key={idx} className="bg-white/60 rounded-2xl p-4 border border-indigo-50 hover:bg-white transition-colors">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold text-white bg-indigo-400 px-2 py-0.5 rounded-full shadow-sm">{m.matchNumStr}</span>
                          <span className="text-sm font-black text-slate-800">{m.homeTeam} <span className="text-slate-300 mx-1 text-[10px]">VS</span> {m.awayTeam}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-2">
                          <div className="text-center bg-indigo-50/50 rounded-xl p-2 border border-indigo-50">
                            <span className="text-[10px] text-slate-400 block mb-1 font-bold">走势预测</span>
                            <span className="text-sm font-black text-amber-600">{m.result}</span>
                          </div>
                          <div className="text-center bg-indigo-50/50 rounded-xl p-2 border border-indigo-50">
                            <span className="text-[10px] text-slate-400 block mb-1 font-bold">参考比分</span>
                            <span className="text-sm font-black text-rose-500">{m.score}</span>
                          </div>
                          <div className="text-center bg-indigo-50/50 rounded-xl p-2 border border-indigo-50">
                            <span className="text-[10px] text-slate-400 block mb-1 font-bold">信心指数</span>
                            <span className="text-sm font-black text-indigo-500">{m.confidence || "-"}</span>
                          </div>
                        </div>
                        {(m.heat || m.risk) && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {m.heat && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${m.heat.includes('高') ? 'bg-rose-50 text-rose-500 border border-rose-100' : m.heat.includes('低') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                🔥热度: {m.heat}
                              </span>
                            )}
                            {m.risk && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                                ⚠️ {m.risk}
                              </span>
                            )}
                          </div>
                        )}
                        {m.reason && (
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50/50 p-2.5 rounded-xl">🧠 {m.reason}</p>
                        )}
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
                  const estimatedCheckTime = new Date(new Date(pred.createdAt).getTime() + 24 * 60 * 60 * 1000);
                  estimatedCheckTime.setHours(12, 0, 0, 0);
                  
                  // 竞彩卡片状态判断
                  const isPending = pred.status === "PENDING";
                  const isFinished = pred.status === "FINISHED";
                  const isHit = isFinished && pred.actualResult && JSON.parse(pred.actualResult).isHit;

                  // 动态样式与高亮条
                  let cardClassName = "relative overflow-hidden bg-white rounded-3xl p-5 md:p-6 border shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300 ";
                  let leftIndicator = "";

                  if (isPending) {
                    cardClassName += "border-amber-100 bg-gradient-to-r from-white to-amber-50/10 shadow-amber-50/5";
                    leftIndicator = "absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-amber-400 to-orange-400";
                  } else if (isHit) {
                    cardClassName += "border-rose-100 bg-gradient-to-r from-white to-rose-50/10 shadow-rose-50/5";
                    leftIndicator = "absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-rose-500 to-amber-400";
                  } else {
                    cardClassName += "border-slate-100 bg-slate-50/50 opacity-75 grayscale-[20%]";
                    leftIndicator = "absolute left-0 top-0 bottom-0 w-[4px] bg-slate-300";
                  }

                  return (
                    <div key={pred.id} className={cardClassName}>
                      {leftIndicator && <div className={leftIndicator} />}
                      <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3 pl-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">
                              {pred.awayTeam === "worldcup" ? "🏆 世界杯专属扫盘" : pred.awayTeam === "champion" ? "🥇 冠军竞猜扫盘" : "⚽️ 日常联赛扫盘"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                            <span>打票: {new Date(pred.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            <span>|</span>
                            {pred.status === "FINISHED" && pred.actualResult && JSON.parse(pred.actualResult).checkedAt ? (
                              <span>对奖: {new Date(JSON.parse(pred.actualResult).checkedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            ) : (
                              <span>预计开奖: {estimatedCheckTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })} 12:00</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          {pred.status === "PENDING" && (
                            <div className="flex gap-2">
                              <a 
                                href="https://www.sporttery.cn/jc/zqsgkj/"
                                target="_blank"
                                rel="noreferrer"
                                title="点击前往体彩官网查看开奖结果"
                                className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors bg-blue-50 text-blue-500 hover:bg-blue-100 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                查赛果
                              </a>
                              <button 
                                onClick={() => handleOpenCalcModal(pred)}
                                title="上传开奖截图让AI自动算奖"
                                className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors bg-purple-50 text-purple-600 hover:bg-purple-100 cursor-pointer"
                              >
                                <Bot className="w-3 h-3" />
                                AI 智能算奖
                              </button>
                              <button 
                                onClick={async () => {
                                  await updateResultMutation.mutateAsync({ id: pred.id, actualResult: JSON.stringify({ isHit: true, checkedAt: new Date().toISOString() }) });
                                  showToast("🎯 已手动标记为红单！");
                                  refetchHistory();
                                }}
                                disabled={updateResultMutation.isPending}
                                title="如果全中，点击这里标记为红单"
                                className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                              >
                                红单
                              </button>
                              <button 
                                onClick={async () => {
                                  await updateResultMutation.mutateAsync({ id: pred.id, actualResult: JSON.stringify({ isHit: false, checkedAt: new Date().toISOString() }) });
                                  showToast("📝 已手动标记为黑单");
                                  refetchHistory();
                                }}
                                disabled={updateResultMutation.isPending}
                                title="如果没中，点击这里标记为黑单"
                                className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors bg-slate-50 text-slate-500 hover:bg-slate-100 cursor-pointer disabled:opacity-50 border border-slate-200"
                              >
                                黑单
                              </button>
                            </div>
                          )}
                          
                          {pred.status === "FINISHED" && pred.actualResult && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 justify-end">
                                <div className={`text-[11px] font-bold px-3 py-1 rounded-full ${JSON.parse(pred.actualResult).isHit ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                                  {JSON.parse(pred.actualResult).isHit ? "🎯 已中奖 (红单)" : "📝 未中奖 (黑单)"}
                                </div>
                                {pred.prizeAmount > 0 && (
                                  <span className="text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                    奖金: ¥{pred.prizeAmount.toFixed(2)}
                                  </span>
                                )}
                                <button 
                                  onClick={async () => {
                                    await updateResultMutation.mutateAsync({ id: pred.id, status: "PENDING", actualResult: "" });
                                    showToast("↩️ 已撤销状态，可重新标记");
                                    refetchHistory();
                                  }}
                                  disabled={updateResultMutation.isPending}
                                  title="点错了？点击撤销标记"
                                  className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors disabled:opacity-50"
                                >
                                  撤销
                                </button>
                              </div>
                              
                              {JSON.parse(pred.actualResult).analysisReasoning && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1">AI 算奖详情</span>
                                  <div className="text-[11px] text-slate-600 leading-relaxed space-y-1.5">
                                    {(JSON.parse(pred.actualResult).analysisReasoning as string)
                                      .split(/(?<=。)(?=周[一二三四五六日]|第[一二三1-9]|总奖金|综合|最终|实际)/)
                                      .map((seg: string, i: number) => (
                                        <p key={i} className={seg.includes('总奖金') || seg.includes('最终') ? 'font-bold text-emerald-700 pt-1 border-t border-slate-200' : ''}>
                                          {seg.trim()}
                                        </p>
                                      ))
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <button 
                            onClick={() => handleDelete(pred.id)}
                            disabled={deletePredictionMutation.isPending}
                            className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 mt-0.5"
                            title="删除历史记录"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-indigo-50/50 rounded-xl p-3 mb-3">
                        <span className="text-[10px] font-bold text-indigo-400 block mb-1">为什么买</span>
                        <span className="font-bold text-slate-700 text-xs leading-relaxed">{p.whyToBuy || p.summary}</span>
                        {p.howToBuy && (
                          <div className="mt-2 pt-2 border-t border-indigo-100/50">
                            <span className="text-[10px] font-bold text-indigo-400 block mb-1">怎么买</span>
                            <span className="font-black text-emerald-800 text-xs block bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-100">{p.howToBuy}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {p.matches?.slice(0, expandedIds.includes(pred.id) ? p.matches.length : 3).map((m: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-bold text-slate-600">{m.homeTeam} <span className="text-[10px] text-slate-400">vs</span> {m.awayTeam}</span>
                            <div className="flex gap-2">
                              {m.heat && m.heat.includes('高') && <span className="text-[10px]" title="高热场次">🔥</span>}
                              {m.confidence && <span className="text-indigo-500 font-bold ml-1">{m.confidence}</span>}
                              <span className="text-amber-600 font-bold ml-1">{m.result}</span>
                              <span className="text-rose-500 font-bold ml-1">{m.score}</span>
                            </div>
                          </div>
                        ))}
                        {p.matches?.length > 3 && (
                          <button 
                            onClick={() => toggleExpand(pred.id)}
                            className="w-full text-center text-[10px] text-slate-400 font-bold mt-2 py-1 hover:text-slate-600 transition-colors bg-slate-50 rounded-lg border border-slate-100"
                          >
                            {expandedIds.includes(pred.id) ? "收起列表" : `展开其余 ${p.matches.length - 3} 场赛事推演 ▾`}
                          </button>
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

        {/* AI 智能算奖 Modal */}
        {calculatingPredId && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2 text-purple-600">
                  <Bot className="w-5 h-5" />
                  <h3 className="font-bold text-lg">AI 智能算奖</h3>
                </div>
                <button onClick={closeCalcModal} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">1. 上传官方开奖截图</label>
                  <p className="text-xs text-slate-400 mb-2">请截取包含您买的对应场次的“赛果”页面</p>
                  {calcImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={calcImage} alt="Uploaded" className="w-full h-auto max-h-48 object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => setCalcImage("")} className="px-4 py-2 bg-white rounded-lg text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors">
                          重新上传
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-6 h-6 text-slate-400 mb-2" />
                        <p className="text-xs text-slate-500 font-medium">点击上传图片或拖拽到此处</p>
                        <p className="text-[10px] text-slate-400 mt-1">💡 也可以直接 Ctrl+V / Cmd+V 粘贴截图</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-2">2. 确认赔率信息</label>
                    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      {calcOddsList.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-600 shrink-0">{item.label}</span>
                          <input 
                            type="number"
                            step="0.01"
                            placeholder="例如: 1.55"
                            className="w-32 bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-right"
                            value={item.value}
                            onChange={(e) => {
                              const newList = [...calcOddsList];
                              newList[idx].value = e.target.value;
                              setCalcOddsList(newList);
                            }}
                          />
                        </div>
                      ))}
                      {calcOddsList.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-2">暂无赛事可填</div>
                      )}
                    </div>
                  </div>

                </div>

                {calcResult && (
                  <div className={`p-4 rounded-xl border ${calcResult.isHit ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      {calcResult.isHit ? (
                        <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">✅ 红单确认</span>
                      ) : (
                        <span className="bg-slate-500 text-white text-xs font-bold px-2 py-1 rounded">❌ 黑单</span>
                      )}
                      {calcResult.prizeAmount > 0 && (
                        <span className="text-emerald-600 font-bold text-sm">奖金: {calcResult.prizeAmount.toFixed(2)} 元</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-white/50 p-3 rounded-lg">
                      {calcResult.analysisReasoning}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                {calculatePrizeMutation.isError && (
                  <div className="bg-red-50 text-red-500 text-xs font-medium p-3 rounded-xl border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{calculatePrizeMutation.error?.message || "算奖失败，请稍后重试"}</span>
                  </div>
                )}
                
                <div className="flex gap-3">
                  {!calcResult ? (
                    <button
                      onClick={handleCalculatePrize}
                      disabled={calculatePrizeMutation.isPending || !calcImage}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {calculatePrizeMutation.isPending ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> AI 分析中...</>
                      ) : (
                        <><Bot className="w-4 h-4" /> 开始智能算奖</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleApplyCalcResult}
                      disabled={updateResultMutation.isPending}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      好的，我知道了
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
