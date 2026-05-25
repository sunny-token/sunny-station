"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trpc } from "@/server/client";
import { Database, RefreshCw, Settings, CircleDot, Layers, ChevronRight, Activity, LogOut, Radar, Cpu, Plus, Trash2 } from "lucide-react";
import LotteryNumbersInput from "@/components/LotteryNumbersInput";

// 组合数计算 C_n_k
const choose = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let res = 1;
  const limit = Math.min(k, n - k);
  for (let i = 1; i <= limit; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return Math.round(res);
};

// 获取单注中奖金额
const getPrizeSingleAmount = (
  type: "ssq" | "dlt",
  level: number,
  name: string,
  latestItem: any
): number => {
  const amounts = latestItem?.prizeAmounts;
  let parsedAmounts: any[] = [];
  try {
    if (amounts) {
      parsedAmounts = typeof amounts === "string" ? JSON.parse(amounts) : amounts;
    }
  } catch {}

  const matchedAmount = parsedAmounts.find(
    (item: any) => item.level === name || item.level?.includes(name)
  );

  if (matchedAmount && matchedAmount.amount) {
    const amtStr = String(matchedAmount.amount).replace(/,/g, "");
    const amt = parseFloat(amtStr);
    if (!isNaN(amt)) return amt;
  }

  // 固定派彩兜底
  if (type === "ssq") {
    switch (level) {
      case 1: return 5000000;
      case 2: return 100000;
      case 3: return 3000;
      case 4: return 200;
      case 5: return 10;
      case 6: return 5;
      default: return 0;
    }
  } else {
    switch (level) {
      case 1: return 5000000;
      case 2: return 100000;
      case 3: return 10000;
      case 4: return 3000;
      case 5: return 300;
      case 6: return 200;
      case 7: return 100;
      case 8: return 15;
      case 9: return 5;
      default: return 0;
    }
  }
};

// 格式化金额显示
const formatPrizeAmount = (amt: number): string => {
  return amt.toLocaleString("zh-CN") + " 元";
};

// 双色球复式中奖解算核心
const calculateSsqMultiPrize = (
  userRed: string[],
  userBlue: string[],
  officialRed: string[],
  officialBlue: string,
  latestItem: any
) => {
  const R = userRed.length;
  const B = userBlue.length;
  
  const matchedRedList = userRed.filter(num => officialRed.includes(num));
  const matchedBlueList = userBlue.filter(num => num === officialBlue);
  
  const r = matchedRedList.length;
  const b = matchedBlueList.length;
  
  const prizeCounts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  for (let k = 0; k <= 6; k++) {
    for (let m = 0; m <= 1; m++) {
      const count = choose(r, k) * choose(R - r, 6 - k) * choose(b, m) * choose(B - b, 1 - m);
      if (count <= 0) continue;
      
      let level = 0;
      if (k === 6 && m === 1) level = 1;
      else if (k === 6 && m === 0) level = 2;
      else if (k === 5 && m === 1) level = 3;
      else if ((k === 5 && m === 0) || (k === 4 && m === 1)) level = 4;
      else if ((k === 4 && m === 0) || (k === 3 && m === 1)) level = 5;
      else if (m === 1) level = 6;
      
      if (level > 0) {
        prizeCounts[level] += count;
      }
    }
  }
  
  const prizeNames: { [key: number]: string } = {
    1: "一等奖", 2: "二等奖", 3: "三等奖", 4: "四等奖", 5: "五等奖", 6: "六等奖"
  };
  
  const prizeList: {
    level: number;
    name: string;
    count: number;
    singleAmountStr: string;
    totalAmountStr: string;
  }[] = [];
  
  let totalAmount = 0;
  
  for (let level = 1; level <= 6; level++) {
    const count = prizeCounts[level];
    if (count > 0) {
      const name = prizeNames[level];
      const singleAmt = getPrizeSingleAmount("ssq", level, name, latestItem);
      const levelTotal = singleAmt * count;
      totalAmount += levelTotal;
      
      prizeList.push({
        level,
        name,
        count,
        singleAmountStr: formatPrizeAmount(singleAmt),
        totalAmountStr: formatPrizeAmount(levelTotal),
      });
    }
  }
  
  return {
    prizeList,
    totalAmountStr: formatPrizeAmount(totalAmount),
    totalAmount,
    r,
    b,
    matchedRedList,
    matchedBlueList
  };
};

// 大乐透复式中奖解算核心
const calculateDltMultiPrize = (
  userFront: string[],
  userBack: string[],
  officialFront: string[],
  officialBack: string[],
  latestItem: any
) => {
  const F = userFront.length;
  const B = userBack.length;
  
  const matchedFrontList = userFront.filter(num => officialFront.includes(num));
  const matchedBackList = userBack.filter(num => officialBack.includes(num));
  
  const f = matchedFrontList.length;
  const b = matchedBackList.length;
  
  const prizeCounts: { [key: number]: number } = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
  };
  
  for (let k = 0; k <= 5; k++) {
    for (let m = 0; m <= 2; m++) {
      const count = choose(f, k) * choose(F - f, 5 - k) * choose(b, m) * choose(B - b, 2 - m);
      if (count <= 0) continue;
      
      let level = 0;
      if (k === 5 && m === 2) level = 1;
      else if (k === 5 && m === 1) level = 2;
      else if (k === 5 && m === 0) level = 3;
      else if (k === 4 && m === 2) level = 4;
      else if (k === 4 && m === 1) level = 5;
      else if (k === 3 && m === 2) level = 6;
      else if (k === 4 && m === 0) level = 7;
      else if ((k === 3 && m === 1) || (k === 2 && m === 2)) level = 8;
      else if (
        (k === 3 && m === 0) || 
        (k === 1 && m === 2) || 
        (k === 2 && m === 1) || 
        (k === 0 && m === 2)
      ) {
        level = 9;
      }
      
      if (level > 0) {
        prizeCounts[level] += count;
      }
    }
  }
  
  const prizeNames: { [key: number]: string } = {
    1: "一等奖", 2: "二等奖", 3: "三等奖", 4: "四等奖",
    5: "五等奖", 6: "六等奖", 7: "七等奖", 8: "八等奖", 9: "九等奖"
  };
  
  const prizeList: {
    level: number;
    name: string;
    count: number;
    singleAmountStr: string;
    totalAmountStr: string;
  }[] = [];
  
  let totalAmount = 0;
  
  for (let level = 1; level <= 9; level++) {
    const count = prizeCounts[level];
    if (count > 0) {
      const name = prizeNames[level];
      const singleAmt = getPrizeSingleAmount("dlt", level, name, latestItem);
      const levelTotal = singleAmt * count;
      totalAmount += levelTotal;
      
      prizeList.push({
        level,
        name,
        count,
        singleAmountStr: formatPrizeAmount(singleAmt),
        totalAmountStr: formatPrizeAmount(levelTotal),
      });
    }
  }
  
  return {
    prizeList,
    totalAmountStr: formatPrizeAmount(totalAmount),
    totalAmount,
    f,
    b,
    matchedFrontList,
    matchedBackList
  };
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const refreshAllMutation = trpc.refreshAll.useMutation();

  const { data: user, isLoading: userLoading } = trpc.auth.getMe.useQuery();
  const isAdmin = user?.role === "ADMIN";

  // 智能最新一期比对中枢核心状态
  const [lotteryType, setLotteryType] = useState<"ssq" | "dlt">("ssq");
  const [inputMode, setInputMode] = useState<"grid" | "panel">("grid");
  const [panelSelected, setPanelSelected] = useState<{ red: string[]; blue: string[] }>({ red: [], blue: [] });
  const [radarSearchDigitsList, setRadarSearchDigitsList] = useState<string[][]>([Array(7).fill("")]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [radarError, setRadarError] = useState("");
  
  const [radarPrizeResult, setRadarPrizeResult] = useState<{
    prizeLevel: number;
    prizeName: string;
    prizeAmount?: string;
    matchedFront?: number;
    matchedBack?: number;
    matchedRed?: number;
    matchedBlue?: number;
    officialNumbers: { red: string[]; blue: string[] };
    userNumbers: { red: string[]; blue: string[] };
    userNumbersList?: { red: string[]; blue: string[] }[];
    issueNumber: string;
    isMultiSelect?: boolean;
    multiSelectedCounts?: { red: number; blue: number };
    multiPrizeList?: {
      level: number;
      name: string;
      count: number;
      singleAmountStr: string;
      totalAmountStr: string;
    }[];
    multiTotalAmountStr?: string;
  } | null>(null);

  // 直接查询最新一期开奖数据
  const { data: latestSsq } = trpc.ssq.getList.useQuery({ page: 1, pageSize: 1 });
  const { data: latestDlt } = trpc.dlt.getList.useQuery({ page: 1, pageSize: 1 });

  // 双色球中奖规则算法（6红+1蓝）
  const checkSsqPrize = (userRed: string[], userBlue: string, officialRed: string[], officialBlue: string) => {
    const matchedRed = userRed.filter(num => officialRed.includes(num)).length;
    const matchedBlue = userBlue === officialBlue ? 1 : 0;

    let prizeLevel = 0;
    let prizeName = "未中奖";

    if (matchedRed === 6 && matchedBlue === 1) {
      prizeLevel = 1;
      prizeName = "一等奖";
    } else if (matchedRed === 6 && matchedBlue === 0) {
      prizeLevel = 2;
      prizeName = "二等奖";
    } else if (matchedRed === 5 && matchedBlue === 1) {
      prizeLevel = 3;
      prizeName = "三等奖";
    } else if ((matchedRed === 5 && matchedBlue === 0) || (matchedRed === 4 && matchedBlue === 1)) {
      prizeLevel = 4;
      prizeName = "四等奖";
    } else if ((matchedRed === 4 && matchedBlue === 0) || (matchedRed === 3 && matchedBlue === 1)) {
      prizeLevel = 5;
      prizeName = "五等奖";
    } else if (matchedBlue === 1) {
      prizeLevel = 6;
      prizeName = "六等奖";
    }

    return { prizeLevel, prizeName, matchedRed, matchedBlue };
  };

  // 大乐透中奖规则算法（5前区+2后区）
  const checkDltPrize = (userFront: string[], userBack: string[], officialFront: string[], officialBack: string[]) => {
    const matchedFront = userFront.filter(num => officialFront.includes(num)).length;
    const matchedBack = userBack.filter(num => officialBack.includes(num)).length;

    let prizeLevel = 0;
    let prizeName = "未中奖";

    if (matchedFront === 5 && matchedBack === 2) {
      prizeLevel = 1;
      prizeName = "一等奖";
    } else if (matchedFront === 5 && matchedBack === 1) {
      prizeLevel = 2;
      prizeName = "二等奖";
    } else if (matchedFront === 5 && matchedBack === 0) {
      prizeLevel = 3;
      prizeName = "三等奖";
    } else if (matchedFront === 4 && matchedBack === 2) {
      prizeLevel = 4;
      prizeName = "四等奖";
    } else if (matchedFront === 4 && matchedBack === 1) {
      prizeLevel = 5;
      prizeName = "五等奖";
    } else if (matchedFront === 3 && matchedBack === 2) {
      prizeLevel = 6;
      prizeName = "六等奖";
    } else if (matchedFront === 4 && matchedBack === 0) {
      prizeLevel = 7;
      prizeName = "七等奖";
    } else if ((matchedFront === 3 && matchedBack === 1) || (matchedFront === 2 && matchedBack === 2)) {
      prizeLevel = 8;
      prizeName = "八等奖";
    } else if (
      (matchedFront === 3 && matchedBack === 0) || 
      (matchedFront === 1 && matchedBack === 2) || 
      (matchedFront === 2 && matchedBack === 1) || 
      (matchedFront === 0 && matchedBack === 2)
    ) {
      prizeLevel = 9;
      prizeName = "九等奖";
    }

    return { prizeLevel, prizeName, matchedFront, matchedBack };
  };

  // 面板点击球动作
  const handlePanelBallClick = (ballType: "red" | "blue", num: string) => {
    setPanelSelected(prev => {
      const list = prev[ballType];
      if (list.includes(num)) {
        return { ...prev, [ballType]: list.filter(n => n !== num) };
      } else {
        return { ...prev, [ballType]: [...list, num].sort((a, b) => parseInt(a) - parseInt(b)) };
      }
    });
  };

  // 面板一键机选动作
  const handlePanelRandomSelect = () => {
    setRadarError("");
    setRadarPrizeResult(null);
    const isSsq = lotteryType === "ssq";
    if (isSsq) {
      const reds: string[] = [];
      while (reds.length < 6) {
        const r = Math.floor(Math.random() * 33) + 1;
        const rStr = r.toString().padStart(2, "0");
        if (!reds.includes(rStr)) reds.push(rStr);
      }
      const b = Math.floor(Math.random() * 16) + 1;
      const bStr = b.toString().padStart(2, "0");
      setPanelSelected({
        red: reds.sort((x, y) => parseInt(x) - parseInt(y)),
        blue: [bStr]
      });
    } else {
      const fronts: string[] = [];
      while (fronts.length < 5) {
        const r = Math.floor(Math.random() * 35) + 1;
        const rStr = r.toString().padStart(2, "0");
        if (!fronts.includes(rStr)) fronts.push(rStr);
      }
      const backs: string[] = [];
      while (backs.length < 2) {
        const r = Math.floor(Math.random() * 12) + 1;
        const rStr = r.toString().padStart(2, "0");
        if (!backs.includes(rStr)) backs.push(rStr);
      }
      setPanelSelected({
        red: fronts.sort((x, y) => parseInt(x) - parseInt(y)),
        blue: backs.sort((x, y) => parseInt(x) - parseInt(y))
      });
    }
  };

  // 统一的彩种切换
  const handleLotteryTypeChange = (type: "ssq" | "dlt") => {
    setLotteryType(type);
    setRadarSearchDigitsList([Array(7).fill("")]);
    setPanelSelected({ red: [], blue: [] });
    setRadarError("");
    setRadarPrizeResult(null);
  };

  // 触发比对计算与雷达解算动画
  const handleStartCompareLatest = () => {
    setRadarError("");
    setRadarPrizeResult(null);

    const isSsq = lotteryType === "ssq";
    
    // 校验录入数据完整性
    if (inputMode === "grid") {
      const requiredLen = 7;
      for (let r = 0; r < radarSearchDigitsList.length; r++) {
        for (let i = 0; i < requiredLen; i++) {
          if (!radarSearchDigitsList[r][i]) {
            setRadarError(`请输入完整的自选号码（第 ${r + 1} 组，第 ${i + 1} 个球未输入）`);
            return;
          }
        }
      }
    } else {
      if (isSsq) {
        if (panelSelected.red.length < 6 || panelSelected.blue.length < 1) {
          setRadarError("复式选号：双色球至少选择 6 个红球和 1 个蓝球！");
          return;
        }
      } else {
        if (panelSelected.red.length < 5 || panelSelected.blue.length < 2) {
          setRadarError("复式选号：大乐透至少选择 5 个前区球 and 2 个后区球！");
          return;
        }
      }
    }

    const latestItem = isSsq ? latestSsq?.data?.list?.[0] : latestDlt?.data?.list?.[0];
    if (!latestItem) {
      setRadarError("暂未读取到云端最新一期开奖数据，请稍后重试");
      return;
    }

    setIsScanning(true);
    setScanStep(1);
    setScanProgress(10);

    setTimeout(() => {
      setScanStep(2);
      setScanProgress(45);
    }, 450);

    setTimeout(() => {
      setScanStep(3);
      setScanProgress(75);
    }, 900);

    setTimeout(() => {
      setScanStep(4);
      setScanProgress(100);

      const officialOpen = latestItem.openNumbers;
      const issueNumber = latestItem.issueNumber;

      if (inputMode === "grid") {
        // 多组单式球格对奖逻辑
        const prizeCounts: { [key: number]: number } = {};
        let totalAmount = 0;
        let isAnyWin = false;
        const userNumbersList: { red: string[]; blue: string[] }[] = [];
        
        const officialRed = officialOpen.red;
        const officialBlueSsq = Array.isArray(officialOpen.blue) ? (officialOpen.blue[0] || "") : (officialOpen.blue || "");
        const officialBlueDlt = officialOpen.blue;

        radarSearchDigitsList.forEach(digits => {
          let level = 0;
          let singleAmt = 0;

          if (isSsq) {
            const userRed = digits.slice(0, 6);
            const userBlue = digits[6];
            userNumbersList.push({ red: userRed, blue: [userBlue] });
            const prizeRes = checkSsqPrize(userRed, userBlue, officialRed, officialBlueSsq);
            level = prizeRes.prizeLevel;
            if (level > 0) {
              singleAmt = getPrizeSingleAmount("ssq", level, prizeRes.prizeName, latestItem);
            }
          } else {
            const userFront = digits.slice(0, 5);
            const userBack = digits.slice(5, 7);
            userNumbersList.push({ red: userFront, blue: userBack });
            const prizeRes = checkDltPrize(userFront, userBack, officialRed, officialBlueDlt);
            level = prizeRes.prizeLevel;
            if (level > 0) {
              singleAmt = getPrizeSingleAmount("dlt", level, prizeRes.prizeName, latestItem);
            }
          }

          if (level > 0) {
            isAnyWin = true;
            prizeCounts[level] = (prizeCounts[level] || 0) + 1;
            totalAmount += singleAmt;
          }
        });

        const prizeNames: { [key: number]: string } = isSsq 
          ? { 1: "一等奖", 2: "二等奖", 3: "三等奖", 4: "四等奖", 5: "五等奖", 6: "六等奖" }
          : { 1: "一等奖", 2: "二等奖", 3: "三等奖", 4: "四等奖", 5: "五等奖", 6: "六等奖", 7: "七等奖", 8: "八等奖", 9: "九等奖" };

        const multiPrizeList = [];
        const maxLevel = isSsq ? 6 : 9;
        for (let level = 1; level <= maxLevel; level++) {
          if (prizeCounts[level] > 0) {
            const name = prizeNames[level];
            const count = prizeCounts[level];
            const singleAmt = getPrizeSingleAmount(lotteryType, level, name, latestItem);
            multiPrizeList.push({
              level,
              name,
              count,
              singleAmountStr: formatPrizeAmount(singleAmt),
              totalAmountStr: formatPrizeAmount(singleAmt * count)
            });
          }
        }

        // 使用复式的格式输出多行单式的结果，方便 UI 通用渲染
        setRadarPrizeResult({
          prizeLevel: isAnyWin ? 1 : 0,
          prizeName: isAnyWin ? "中奖" : "未中奖",
          officialNumbers: { red: officialRed, blue: isSsq ? [officialBlueSsq] : officialBlueDlt },
          userNumbers: userNumbersList[0], // fallback 兼容
          userNumbersList,
          issueNumber,
          isMultiSelect: true, // 设置为 true 复用多注开奖展现
          multiSelectedCounts: { red: 0, blue: 0 },
          multiPrizeList,
          multiTotalAmountStr: formatPrizeAmount(totalAmount)
        });
      } else {
        // 复式选号面板对奖逻辑
        if (isSsq) {
          const officialRed = officialOpen.red;
          const officialBlue = Array.isArray(officialOpen.blue) 
            ? (officialOpen.blue[0] || "") 
            : (officialOpen.blue || "");

          const multiRes = calculateSsqMultiPrize(panelSelected.red, panelSelected.blue, officialRed, officialBlue, latestItem);
          setRadarPrizeResult({
            prizeLevel: multiRes.prizeList.length > 0 ? 1 : 0,
            prizeName: multiRes.prizeList.length > 0 ? "中奖" : "未中奖",
            officialNumbers: { red: officialRed, blue: [officialBlue] },
            userNumbers: { red: panelSelected.red, blue: panelSelected.blue },
            issueNumber,
            isMultiSelect: true,
            multiSelectedCounts: { red: panelSelected.red.length, blue: panelSelected.blue.length },
            multiPrizeList: multiRes.prizeList,
            multiTotalAmountStr: multiRes.totalAmountStr
          });
        } else {
          const officialFront = officialOpen.red;
          const officialBack = officialOpen.blue;

          const multiRes = calculateDltMultiPrize(panelSelected.red, panelSelected.blue, officialFront, officialBack, latestItem);
          setRadarPrizeResult({
            prizeLevel: multiRes.prizeList.length > 0 ? 1 : 0,
            prizeName: multiRes.prizeList.length > 0 ? "中奖" : "未中奖",
            officialNumbers: { red: officialFront, blue: officialBack },
            userNumbers: { red: panelSelected.red, blue: panelSelected.blue },
            issueNumber,
            isMultiSelect: true,
            multiSelectedCounts: { red: panelSelected.red.length, blue: panelSelected.blue.length },
            multiPrizeList: multiRes.prizeList,
            multiTotalAmountStr: multiRes.totalAmountStr
          });
        }
      }
      setScanStep(5);
    }, 1500);
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

      {/* 智能最新一期比对中枢入口 */}
      <div className="mb-10 relative z-10">
        <div className="group relative rounded-[2.5rem] p-8 md:p-10 bg-white/70 border border-slate-200/80 shadow-[0_15px_40px_rgba(99,102,241,0.04)] backdrop-blur-xl transition-all duration-500 overflow-hidden flex flex-col justify-between gap-8 animate-in slide-in-from-top-4 duration-500">
          
          {/* 装饰渐变光效 */}
          <div className="absolute right-[-10%] top-[-20%] w-[350px] h-[350px] bg-gradient-to-br from-indigo-500/5 to-rose-500/5 blur-[80px] rounded-full pointer-events-none" />
          
          {/* 上半部分：标题与类型选择 */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 w-full relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-rose-50 border border-indigo-100/50 text-indigo-600 text-[10px] font-bold tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
                快捷自选对奖器
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                最新一期号码智能对奖
              </h2>
              <p className="text-sm text-slate-500 font-light leading-relaxed">
                {inputMode === "grid" 
                  ? "无需对比复杂的守号或配置邮件。只需在下方输入您的自选号码，支持粘贴，即可快速比对最新一期！" 
                  : "流光复式点选面板。支持选择任意多个红蓝球，自动基于组合数学公式计算并汇总中奖明细及累计派彩额！"}
              </p>
            </div>

            {/* 彩种选择与模式切换双组合键 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 font-bold text-xs shrink-0 self-stretch sm:self-auto">
              {/* 彩种切换 */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/40">
                <button
                  onClick={() => handleLotteryTypeChange("ssq")}
                  className={`px-4 py-2 rounded-xl transition-all duration-300 ${lotteryType === "ssq" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  双色球
                </button>
                <button
                  onClick={() => handleLotteryTypeChange("dlt")}
                  className={`px-4 py-2 rounded-xl transition-all duration-300 ${lotteryType === "dlt" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  大乐透
                </button>
              </div>
              
              {/* 模式切换 */}
              <div className="flex bg-indigo-50/50 p-1.5 rounded-2xl border border-indigo-100/40">
                <button
                  onClick={() => {
                    setInputMode("grid");
                    setRadarError("");
                    setRadarPrizeResult(null);
                  }}
                  className={`px-4 py-2 rounded-xl transition-all duration-300 ${inputMode === "grid" ? "bg-slate-900 text-white shadow-sm" : "text-indigo-600 hover:text-indigo-900"}`}
                >
                  🔢 单式球格
                </button>
                <button
                  onClick={() => {
                    setInputMode("panel");
                    setRadarError("");
                    setRadarPrizeResult(null);
                  }}
                  className={`px-4 py-2 rounded-xl transition-all duration-300 ${inputMode === "panel" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-500 hover:text-indigo-800"}`}
                >
                  🎛️ 面板复式
                </button>
              </div>
            </div>
          </div>

          {/* 中间部分：录入区 */}
          {inputMode === "grid" ? (
            <div className="w-full bg-slate-50/60 p-6 rounded-3xl border border-slate-200/40 flex flex-col gap-6 relative z-10">
              <div className="flex flex-col gap-4 w-full">
                {radarSearchDigitsList.map((digits, rowIndex) => (
                  <div key={rowIndex} className="flex flex-col sm:flex-row sm:items-center gap-4 w-full group/row">
                    <span className="text-xs font-bold text-slate-500 shrink-0 select-none sm:w-[60px]">
                      {radarSearchDigitsList.length > 1 ? `第 ${rowIndex + 1} 组` : '输入号码'}：
                    </span>
                    
                    <div className="flex-1">
                      <LotteryNumbersInput
                        lotteryType={lotteryType}
                        redNumbers={digits.slice(0, lotteryType === "ssq" ? 6 : 5)}
                        blueNumbers={digits.slice(lotteryType === "ssq" ? 6 : 5)}
                        onChange={(red, blue) => {
                          const newList = [...radarSearchDigitsList];
                          newList[rowIndex] = [...red, ...blue];
                          setRadarSearchDigitsList(newList);
                        }}
                      />
                    </div>

                    {radarSearchDigitsList.length > 1 && (
                      <button
                        onClick={() => {
                          const newList = [...radarSearchDigitsList];
                          newList.splice(rowIndex, 1);
                          setRadarSearchDigitsList(newList);
                        }}
                        className="w-10 h-10 rounded-full border border-rose-200 text-rose-400 hover:bg-rose-50 hover:text-rose-600 flex flex-shrink-0 items-center justify-center transition-colors sm:opacity-0 sm:group-hover/row:opacity-100"
                        title="删除该组号码"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mt-2">
                <button
                  onClick={() => setRadarSearchDigitsList([...radarSearchDigitsList, Array(7).fill("")])}
                  className="w-full lg:w-auto px-6 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加一组</span>
                </button>

                {/* 比冲按钮 */}
                <button
                  onClick={handleStartCompareLatest}
                  className="w-full lg:w-auto relative px-8 h-12 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wider shadow-sm hover:bg-slate-800 transition-all active:scale-[0.98] shrink-0 flex items-center justify-center gap-2 group/btn"
                >
                  <Cpu className="w-4 h-4 text-indigo-300 group-hover/btn:rotate-90 transition-transform duration-500" />
                  <span>开始比对最新一期</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            // 面板多选控制台视图 (WOW级发光交互面板)
            <div className="w-full space-y-6 relative z-10 animate-in fade-in slide-in-from-top-2 duration-300">
              
              {/* 控制操作栏 */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/50 p-4 rounded-2xl text-xs">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-500">
                  <span>💡 规则：</span>
                  <span className={lotteryType === "ssq" ? "text-rose-600" : "text-emerald-600"}>
                    {lotteryType === "ssq" ? "🔴 红球 ≥ 6个" : "🟢 前区 ≥ 5个"}
                  </span>
                  <span className="text-slate-350">|</span>
                  <span className="text-indigo-600">
                    {lotteryType === "ssq" ? "🔵 蓝球 ≥ 1个" : "🔵 后区 ≥ 2个"}
                  </span>
                  <span className="text-slate-350">|</span>
                  <span className="bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded text-indigo-700">
                    已选：{panelSelected.red.length} 红 + {panelSelected.blue.length} 蓝
                  </span>
                  <span className="text-slate-350">|</span>
                  <span className="font-bold text-slate-700">
                    共形成组合：
                    <span className="font-mono text-indigo-600 text-sm font-black mx-0.5">
                      {lotteryType === "ssq" 
                        ? choose(panelSelected.red.length, 6) * choose(panelSelected.blue.length, 1)
                        : choose(panelSelected.red.length, 5) * choose(panelSelected.blue.length, 2)}
                    </span> 注
                  </span>
                </div>
                
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
                  <button
                    onClick={handlePanelRandomSelect}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl font-bold transition-all hover:bg-indigo-100 active:scale-95 text-[10px]"
                  >
                    🎲 随机机选一注
                  </button>
                  <button
                    onClick={() => {
                      setPanelSelected({ red: [], blue: [] });
                      setRadarError("");
                      setRadarPrizeResult(null);
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold transition-all hover:bg-slate-200 active:scale-95 text-[10px]"
                  >
                    🗑️ 一键重置清空
                  </button>
                </div>
              </div>

              {/* 红球/前区选号区 */}
              <div className="space-y-3 bg-slate-50/40 p-6 rounded-[2rem] border border-slate-200/40">
                <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase pl-1 text-left select-none">
                  {lotteryType === "ssq" ? "🔴 红球选号区 (01 - 33)" : "🟢 前区选号区 (01 - 35)"}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: lotteryType === "ssq" ? 33 : 35 }).map((_, i) => {
                    const numStr = (i + 1).toString().padStart(2, "0");
                    const isSelected = panelSelected.red.includes(numStr);
                    return (
                      <button
                        key={numStr}
                        onClick={() => handlePanelBallClick("red", numStr)}
                        className={`w-9 h-9 rounded-xl font-bold text-xs transition-all border outline-none duration-200 ${
                          isSelected
                            ? lotteryType === "ssq"
                              ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-200 scale-105 ring-2 ring-rose-100 font-black"
                              : "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200 scale-105 ring-2 ring-emerald-100 font-black"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                        }`}
                      >
                        {numStr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 蓝球/后区选号区 */}
              <div className="space-y-3 bg-slate-50/40 p-6 rounded-[2rem] border border-slate-200/40">
                <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase pl-1 text-left select-none">
                  {lotteryType === "ssq" ? "🔵 蓝球选号区 (01 - 16)" : "🔵 后区选号区 (01 - 12)"}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: lotteryType === "ssq" ? 16 : 12 }).map((_, i) => {
                    const numStr = (i + 1).toString().padStart(2, "0");
                    const isSelected = panelSelected.blue.includes(numStr);
                    return (
                      <button
                        key={numStr}
                        onClick={() => handlePanelBallClick("blue", numStr)}
                        className={`w-9 h-9 rounded-xl font-bold text-xs transition-all border outline-none duration-200 ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 scale-105 ring-2 ring-indigo-100 font-black"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                        }`}
                      >
                        {numStr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 底部居中比对按钮 */}
              <div className="flex items-center justify-center pt-2">
                <button
                  onClick={handleStartCompareLatest}
                  className="w-full sm:w-auto px-12 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wider shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 group/btn"
                >
                  <Cpu className="w-4 h-4 text-indigo-300 group-hover/btn:rotate-90 transition-transform duration-500" />
                  <span>执行最新一期复式比对</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>

            </div>
          )}

          {/* 错误提示文字 */}
          {radarError && (
            <div className="text-xs text-rose-500 font-bold bg-rose-50 border border-rose-100 px-4 py-2.5 rounded-xl relative z-10 w-full animate-in fade-in duration-300">
              ⚠️ 提示：{radarError}
            </div>
          )}
          
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

      {/* 智能雷达对奖舱全屏弹窗 */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg p-8 md:p-10 rounded-[2.5rem] bg-white border border-slate-200/80 shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300 flex flex-col items-center text-center space-y-6">
            
            {/* 彩色背景光 */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-100/30 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-rose-100/30 blur-[80px] rounded-full pointer-events-none" />
            
            {/* 雷达动态扫描球体区 */}
            {scanStep < 5 && (
              <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-slate-50 border border-slate-100/80 shadow-inner mt-4 overflow-hidden animate-in zoom-in-90 duration-300">
                <div className="absolute inset-2 border border-slate-200/40 rounded-full" />
                <div className="absolute inset-8 border border-slate-200/30 rounded-full" />
                <div className="absolute inset-16 border border-slate-200/20 rounded-full" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-200/30" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-200/30" />
                
                {/* 旋转光束 */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 via-indigo-500/[0.08] to-indigo-500/20 origin-center animate-spin" style={{ animationDuration: '1.8s' }} />
                
                <div className="relative z-10 p-5 bg-white border border-slate-200/60 rounded-full shadow-md text-indigo-600 animate-pulse">
                  <Radar className="w-10 h-10 text-indigo-500" />
                </div>
              </div>
            )}

            {/* 解算标题 */}
            <div className="space-y-2 relative z-10 w-full">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                {scanStep === 5 ? "中央雷达比对完毕" : "中央雷达正在全网比对"}
              </h3>
              
              {/* 进度百分比 */}
              {scanStep < 5 && (
                <>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative mt-1">
                    <div 
                      className="h-full transition-all duration-300 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                    <span>最新一期解算舱</span>
                    <span className="font-mono text-xs text-indigo-600">{scanProgress}%</span>
                  </div>
                </>
              )}
            </div>

            {/* 步骤描述框与喜报通报框 */}
            <div className="w-full bg-slate-50/80 border border-slate-200/60 rounded-3xl p-6 min-h-[110px] flex items-center justify-center relative z-10 text-xs text-slate-500 leading-relaxed font-semibold transition-all shadow-inner">
              {scanStep === 1 && "📡 步骤 1/3: 正在握手官方数据枢纽，获取最新一期开奖走势..."}
              {scanStep === 2 && `🔴 步骤 2/3: 正在智能对齐 [最新第 ${lotteryType === "ssq" ? latestSsq?.data?.list?.[0]?.issueNumber : latestDlt?.data?.list?.[0]?.issueNumber} 期] 的官方开奖号码图谱...`}
              {scanStep === 3 && "⚡️ 步骤 3/3: 正在进行自选号码的高能交叉解算与命中概率解密..."}
              
              {/* 比对结果完美喜报 */}
              {scanStep === 5 && radarPrizeResult && (
                <div className="w-full space-y-4 animate-in zoom-in-95 duration-500">
                  {radarPrizeResult.isMultiSelect ? (
                    // 复式中奖喜报
                    radarPrizeResult.multiPrizeList && radarPrizeResult.multiPrizeList.length > 0 ? (
                      <div className="space-y-3.5 w-full text-center">
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-black shadow-[0_2px_12px_rgba(245,158,11,0.15)] animate-bounce">
                          🎉 恭喜中奖 ➔ {radarPrizeResult.multiSelectedCounts?.red === 0 ? "单式多组喜迎大丰收！" : "复式喜迎大丰收！"}
                        </div>

                        {/* 复式总金额展示盒 */}
                        {radarPrizeResult.multiTotalAmountStr && (
                          <div className="py-3 px-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 rounded-2xl border border-amber-200/50 flex flex-col items-center justify-center gap-1 shadow-sm">
                            <span className="text-[10px] text-amber-600/80 font-bold uppercase tracking-wider">{radarPrizeResult.multiSelectedCounts?.red === 0 ? "多组累计中奖总金额" : "复式累计中奖总金额"}</span>
                            <span className="text-3xl font-black text-rose-600 tracking-tight drop-shadow-sm font-mono animate-pulse">
                              {radarPrizeResult.multiTotalAmountStr}
                            </span>
                          </div>
                        )}

                        {/* 详细中奖清单 */}
                        <div className="space-y-2 bg-slate-50 border border-slate-200/50 p-4 rounded-2xl">
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-left pl-1">
                            🏆 派奖明细详单：
                          </div>
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {radarPrizeResult.multiPrizeList.map((item) => (
                              <div key={item.level} className="flex items-center justify-between bg-white border border-slate-100 p-2.5 rounded-xl text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{item.name}</span>
                                  <span className="bg-rose-50 border border-rose-100 text-rose-600 px-2 py-0.5 rounded font-black text-[10px] scale-95">
                                    {item.count} 注
                                  </span>
                                </div>
                                <span className="font-mono text-slate-500 text-[10px]">
                                  单注: {item.singleAmountStr} ➔ 共: <span className="font-bold text-rose-600">{item.totalAmountStr}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 font-normal">
                          恭喜您！您的{radarPrizeResult.multiSelectedCounts?.red === 0 ? "单式多组选号" : "复式选号"}成功击中了官方最新开奖第 <span className="font-bold text-slate-900 font-mono">{radarPrizeResult.issueNumber}</span> 期的开奖号码！
                        </p>
                      </div>
                    ) : (
                      // 复式未中奖
                      <div className="space-y-3 w-full text-center">
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-xs font-black">
                          😅 本期遗憾未中奖
                        </div>
                        <p className="text-xs text-slate-500 font-normal">
                          {radarPrizeResult.multiSelectedCounts?.red === 0 
                            ? `您录入的 ${radarPrizeResult.userNumbersList?.length || 0} 组单式选号`
                            : `您录入的复式选号组合（共 ${radarPrizeResult.userNumbers.red.length} 红 + ${radarPrizeResult.userNumbers.blue.length} 蓝）`
                          }在最新第 <span className="font-bold text-slate-900 font-mono">{radarPrizeResult.issueNumber}</span> 期中未能击中任何奖项。好运总在下一次，加油！
                        </p>
                      </div>
                    )
                  ) : (
                    // 单式中奖喜报
                    radarPrizeResult.prizeLevel > 0 ? (
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-black shadow-[0_2px_12px_rgba(245,158,11,0.15)] animate-bounce">
                          🎉 恭喜中奖 ➔ 荣获【{radarPrizeResult.prizeName}】！
                        </div>

                        {radarPrizeResult.prizeAmount && (
                          <div className="py-2.5 px-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 rounded-2xl border border-amber-200/50 flex flex-col items-center justify-center gap-0.5">
                            <span className="text-[10px] text-amber-600/80 font-bold uppercase tracking-wider">官方预测中奖金额</span>
                            <span className="text-2xl font-black text-rose-600 tracking-tight drop-shadow-sm font-mono">
                              {radarPrizeResult.prizeAmount}
                            </span>
                          </div>
                        )}

                        <p className="text-xs text-slate-500 font-normal">
                          恭喜您！您的自选号码成功击中了官方最新开奖第 <span className="font-bold text-slate-900 font-mono">{radarPrizeResult.issueNumber}</span> 期的开奖号码！
                        </p>
                      </div>
                    ) : (
                      // 单式未中奖
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-xs font-black">
                          😅 本期遗憾未中奖
                        </div>
                        <p className="text-xs text-slate-500 font-normal">
                          您录入的自选号码在最新第 <span className="font-bold text-slate-900 font-mono">{radarPrizeResult.issueNumber}</span> 期中未能击中任何奖项。好运总在下一次，加油！
                        </p>
                      </div>
                    )
                  )}

                  {/* 球格高亮渲染图谱区 */}
                  <div className="space-y-2 mt-2">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-left pl-1">
                      您的球格命中情况（彩色代表击中，灰色代表未中）：
                    </div>
                    
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {(radarPrizeResult.userNumbersList || [radarPrizeResult.userNumbers]).map((userNumSet, groupIdx) => (
                        <div key={groupIdx} className="flex flex-wrap items-center justify-start sm:justify-center gap-2 bg-white border border-slate-100 p-3.5 rounded-2xl shadow-sm">
                          {radarPrizeResult.userNumbersList && radarPrizeResult.userNumbersList.length > 1 && (
                            <div className="text-[10px] font-bold text-slate-400 w-full sm:w-auto text-left sm:text-center shrink-0 mr-1 pb-1 sm:pb-0 border-b sm:border-b-0 border-slate-100">
                              组 {groupIdx + 1}
                            </div>
                          )}
                          
                          {/* 前区/红球 */}
                          {userNumSet.red.map((num, idx) => {
                            const isMatched = radarPrizeResult.officialNumbers.red.includes(num);
                            return (
                              <div
                                key={idx}
                                className={`relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-500 ${
                                  isMatched 
                                    ? lotteryType === "ssq"
                                      ? "bg-rose-500 text-white shadow-md shadow-rose-200 ring-4 ring-rose-100 scale-105 z-10"
                                      : "bg-emerald-500 text-white shadow-md shadow-emerald-200 ring-4 ring-emerald-100 scale-105 z-10"
                                    : "bg-slate-100 text-slate-400 opacity-40 border border-slate-200"
                                }`}
                              >
                                {num}
                                {isMatched && <div className="absolute -inset-0.5 bg-current opacity-10 rounded-xl animate-ping" />}
                              </div>
                            );
                          })}

                          <div className="w-[1px] h-6 bg-slate-200 mx-1 shrink-0 hidden sm:block" />

                          {/* 后区/蓝球 */}
                          {userNumSet.blue.map((num, idx) => {
                            const isMatched = radarPrizeResult.officialNumbers.blue.includes(num);
                            return (
                              <div
                                key={idx}
                                className={`relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-500 ${
                                  isMatched 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100 scale-105 z-10"
                                    : "bg-slate-100 text-slate-400 opacity-40 border border-slate-200"
                                }`}
                              >
                                {num}
                                {isMatched && <div className="absolute -inset-0.5 bg-indigo-400 opacity-10 rounded-xl animate-ping" />}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 官方中奖号码对照线 */}
                  <div className="text-[10px] text-slate-400 font-bold tracking-wider text-left flex flex-wrap items-center gap-1.5 pl-1 pt-1">
                    <span>💡 最新第 {radarPrizeResult.issueNumber} 期开奖参考图谱：</span>
                    <span className="font-mono text-slate-600 font-bold">
                      {radarPrizeResult.officialNumbers.red.join(" ")}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-350" />
                    <span className="font-mono text-indigo-500 font-bold">
                      {radarPrizeResult.officialNumbers.blue.join(" ")}
                    </span>
                  </div>

                </div>
              )}
            </div>

            {/* 关闭确定动作按钮 */}
            {scanStep === 5 && (
              <button
                onClick={() => {
                  setIsScanning(false);
                  setRadarPrizeResult(null);
                }}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wider transition-all active:scale-[0.98] shadow-md relative z-10"
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
