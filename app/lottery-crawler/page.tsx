"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatDate } from "../../lib/utils";
import { useRouter } from "next/navigation";
import { trpc } from "../../server/client";
import LotteryNumbersInput from "@/components/LotteryNumbersInput";
import { Loader2, Settings2, ArrowLeft, Wifi, CircleDot, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LotteryCrawlerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [searchInput, setSearchInput] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [isExactMatch, setIsExactMatch] = useState(false);

  // 号码搜寻状态（长度为 7，前 6 个是红球，第 7 个是蓝球）
  const [searchDigits, setSearchDigits] = useState<string[]>(Array(7).fill(""));


  const [selectedPrizeInfo, setSelectedPrizeInfo] = useState<{
    issueNumber: string;
    openDate: string;
    prizeAmounts: Array<{ level: string; amount: string }> | null;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pageSize = 10;

  // trpc hooks
  const {
    data,
    isLoading: listLoading,
    refetch,
  } = trpc.ssq.getList.useQuery(
    { page: currentPage, pageSize },
    { enabled: !isSearching },
  );
  const mutation = trpc.ssq.fetchAndSave.useMutation();

  // 获取当前登录用户，判断角色
  const { data: user, isLoading: userLoading } = trpc.auth.getMe.useQuery();
  const isAdmin = user?.role === "ADMIN";

  // 获取双色球激活的守号号码
  const { data: ticketData } = trpc.ticket.getList.useQuery({
    lotteryType: "ssq",
    isActive: true,
    page: 1,
    pageSize: 100, // 获取所有激活的守号号码
  });

  // 解析搜索输入为号码数组（支持空格和逗号分隔）
  const parseSearchNumbers = (input: string): string[] => {
    return input
      .trim()
      .split(/[\s,]+/)
      .filter((n) => n.trim() !== "")
      .map((n) => n.trim());
  };

  const {
    data: searchData,
    isLoading: searchLoading,
    refetch: searchRefetch,
  } = trpc.ssq.search.useQuery(
    {
      numbers: parseSearchNumbers(searchInput),
      exactMatch: isExactMatch,
      page: searchCurrentPage,
      pageSize,
    },
    { enabled: false },
  );

  useEffect(() => {
    if (data?.data?.total) {
      setTotalPages(Math.ceil(data.data.total / pageSize));
    }
  }, [data, pageSize]);

  useEffect(() => {
    if (searchData?.data?.total) {
      setSearchTotalPages(Math.ceil(searchData.data.total / pageSize));
    }
  }, [searchData, pageSize]);

  // 当搜索页码变化时，重新获取搜索结果
  useEffect(() => {
    if (isSearching && searchInput.trim()) {
      searchRefetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCurrentPage, isExactMatch]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleStart = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await mutation.mutateAsync({ year: selectedYear });
      if (res.success) {
        setResult(`爬取并写入成功，新增 ${res.count} 条数据。`);
        refetch();
      } else {
        setResult("同步失败：节点响应异常");
      }
    } catch (e) {
      setResult(`请求异常: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const numbers = parseSearchNumbers(searchInput);
    if (numbers.length === 0) {
      setResult("请输入至少1个号码进行搜索");
      return;
    }
    if (numbers.length > 7) {
      setResult("最多输入7个号码进行搜索");
      return;
    }
    setIsSearching(true);
    setSearchCurrentPage(1); // 重置搜索页码
    setResult(null);
    try {
      await searchRefetch();
    } catch (e) {
      setResult(`搜索异常: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSearchPageChange = (page: number) => {
    setSearchCurrentPage(page);
  };

  const handleClearSearch = () => {
    setIsSearching(false);
    setSearchInput("");
    setSearchDigits(Array(7).fill(""));
    setSearchCurrentPage(1);
    setResult(null);
  };

  // 决定显示哪个数据源
  const displayData = isSearching ? searchData : data;
  const displayLoading = isSearching ? searchLoading : listLoading;

  // 缓存搜索号码列表（区分前区红球和后区蓝球）
  // 双色球：前6个是红球，第7个是蓝球
  const searchRedNumbersSet = useMemo(() => {
    if (!isSearching || !searchInput.trim()) return new Set<string>();
    const numbers = parseSearchNumbers(searchInput)
      .slice(0, 6)
      .map((n) => {
        const num = parseInt(n, 10);
        if (isNaN(num)) return null;
        return num.toString().padStart(2, "0");
      })
      .filter((n): n is string => n !== null);
    return new Set(numbers);
  }, [isSearching, searchInput]);

  const searchBlueNumber = useMemo(() => {
    if (!isSearching || !searchInput.trim()) return null;
    const numbers = parseSearchNumbers(searchInput);
    if (numbers.length >= 7) {
      const num = parseInt(numbers[6], 10);
      if (isNaN(num)) return null;
      return num.toString().padStart(2, "0");
    }
    return null;
  }, [isSearching, searchInput]);

  // 检查号码是否在搜索列表中（用于高亮显示）
  // isRed: true表示红球，false表示蓝球
  const isNumberMatched = (num: string | number, isRed: boolean): boolean => {
    if (!isSearching) {
      return true;
    }
    const numStr = typeof num === "string" ? num : num.toString();
    const numValue = parseInt(numStr, 10);
    if (isNaN(numValue)) return false;
    const normalizedNum = numValue.toString().padStart(2, "0");

    if (isRed) {
      return searchRedNumbersSet.has(normalizedNum);
    } else {
      return searchBlueNumber === normalizedNum;
    }
  };

  // 获取用户信息时渲染安全网关加载界面，避免闪烁
  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-rose-100/20 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
          <p className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
            正在安全验证身份凭证...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 selection:bg-rose-500/10 relative overflow-x-hidden">
      {/* 氛围背景微网格与柔和渐变 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-100/20 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/20 blur-[130px] rounded-full" />
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto p-4 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12 border-b border-slate-200/60 pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100/80 text-rose-600 text-xs font-bold tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              官方数据同步中心
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none">
              双色球 <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-pink-500 to-indigo-600">智能对奖端</span>
            </h1>
            <p className="text-slate-500 text-sm md:text-base font-normal max-w-lg">
              查询官方开奖历史数据，并支持自选及守号号码的智能比对与对奖分析。
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <button
              onClick={() => router.push("/")}
              className="group flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all duration-300 font-semibold shadow-sm flex-1 sm:flex-none justify-center text-xs"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>返回主页</span>
            </button>
            <button
              onClick={() => router.push("/lottery-dlt-crawler")}
              className="group relative px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:text-amber-600 hover:border-amber-200 transition-all duration-300 shadow-sm flex-1 sm:flex-none justify-center text-xs"
            >
              <span className="relative flex items-center gap-1.5 justify-center">
                切换为大乐透 <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-slate-50 transition-all duration-300 flex items-center gap-2 shadow-sm font-semibold flex-1 sm:flex-none justify-center text-xs"
            >
              <Settings2 className="w-4 h-4 text-slate-400 group-hover:rotate-45 transition-transform duration-500" />
              设置中心
            </button>
          </div>
        </header>

        {/* 智能号码对奖一体化卡片 */}
        <div className="mb-12">
          <section className="w-full p-8 rounded-[2.5rem] bg-white border border-slate-200/80 shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* 顶栏：标题与开关 */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-bold text-slate-900">自选号码智能比对</span>
                  <span className="text-[11px] text-slate-400 font-medium">快速在历史开奖中检索您的号码是否中奖</span>
                </div>
                
                {/* 匹配开关 */}
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className={`w-9 h-5.5 flex items-center rounded-full transition-colors duration-300 ${isExactMatch ? 'bg-rose-500 shadow-sm shadow-rose-100' : 'bg-slate-200'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform duration-300 transform mx-1 shadow-sm ${isExactMatch ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    checked={isExactMatch}
                    onChange={(e) => setIsExactMatch(e.target.checked)}
                    className="hidden"
                  />
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors select-none">严格顺序匹配</span>
                </label>
              </div>

              {/* 中栏：球格输入核心区 */}
              <div className="space-y-4 py-4 bg-slate-50/50 rounded-2xl p-5 border border-slate-100/80">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
                  <span className="text-xs font-bold text-slate-500 sm:w-16 flex-shrink-0">输入号码：</span>
                  
                  <LotteryNumbersInput
                    lotteryType="ssq"
                    redNumbers={searchDigits.slice(0, 6)}
                    blueNumbers={searchDigits.slice(6)}
                    onChange={(red, blue) => {
                      const combined = [...red, ...blue];
                      setSearchDigits(combined);
                      setSearchInput(combined.map(d => d.trim()).filter(d => d !== "").join(" "));
                    }}
                  />

                </div>
                
                <p className="text-xs text-slate-400 font-normal pl-0 sm:pl-16 tracking-tight leading-relaxed">
                  💡 提示：支持从网页或文本直接复制整行由空格或逗号分隔的号码，直接粘贴至第一个红球格，系统会自动进行智能拆分填充。
                </p>
              </div>

            </div>

            {/* 底栏：重置与检索动作栏 + 数据同步合并项 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 border-t border-slate-100 mt-6">
              {/* 左侧：云端开奖历史同步（仅 Admin 可见） */}
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2 max-w-lg">
                  <span className="text-xs font-bold text-slate-500 w-16 flex-shrink-0">历史同步：</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 outline-none cursor-pointer focus:border-rose-500 focus:bg-white transition-all shadow-sm font-bold text-xs"
                  >
                    {Array.from(
                      { length: new Date().getFullYear() - 1999 },
                      (_, i) => new Date().getFullYear() - i,
                    ).map((year) => (
                      <option key={year} value={year} className="bg-white text-slate-700">
                        {year} 年度
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleStart}
                    disabled={loading || userLoading}
                    className="h-10 px-4.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                        <span>同步中...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5" />
                        <span>同步云端开奖</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 右侧：比对控制 */}
              <div className="flex items-center gap-3 justify-end ml-auto">
                <button
                  onClick={handleClearSearch}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.95] ${isSearching ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  重置
                </button>
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="px-6 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold tracking-wider disabled:opacity-50 shadow-sm transition-all active:scale-[0.95] whitespace-nowrap"
                >
                  {searchLoading ? "正在比对..." : "开始比对号码"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* 系统状态微通知栏（平移至卡片正下方） */}
        <div className="mb-12 flex justify-start">
          {(() => {
            const isPending = loading || searchLoading;
            const hasResult = !!result;
            const isSuccess = hasResult && (result.includes("成功") || result.includes("完成") || result.includes("导入") || result.includes("匹配"));
            const isError = hasResult && (result.includes("失败") || result.includes("异常") || result.includes("阻断") || result.includes("未") || result.includes("错误"));

            let statusBg = "bg-slate-50/80 border-slate-200/60 text-slate-600";
            let badgeBg = "bg-slate-100 text-slate-500";
            let pulseColor = "bg-slate-400";
            let statusTitle = "系统就绪";
            let statusText = "自动对奖系统准备就绪。请输入号码或同步数据。";
            
            if (isPending) {
              statusBg = "bg-indigo-50/80 border-indigo-100/80 text-indigo-800 shadow-[0_2px_12px_rgba(79,70,229,0.03)] animate-pulse";
              badgeBg = "bg-indigo-100 text-indigo-600";
              pulseColor = "bg-indigo-500";
              statusTitle = loading ? "正在同步" : "正在比对";
              statusText = loading 
                ? "正在从云端数据中心拉取并更新官方历史数据，请稍候..."
                : "正在智能比对自选号码与官方开奖历史数据谱图...";
            } else if (isSuccess) {
              statusBg = "bg-emerald-50/80 border-emerald-100/80 text-emerald-800 shadow-[0_2px_12px_rgba(16,185,129,0.03)]";
              badgeBg = "bg-emerald-100 text-emerald-600";
              pulseColor = "bg-emerald-500";
              statusTitle = "同步成功";
              statusText = result || "操作已圆满完成";
            } else if (isError) {
              statusBg = "bg-rose-50/80 border-rose-100/80 text-rose-800 shadow-[0_2px_12px_rgba(225,29,72,0.03)]";
              badgeBg = "bg-rose-100 text-rose-600";
              pulseColor = "bg-rose-500";
              statusTitle = "同步异常";
              statusText = result || "请检查系统或稍后重试";
            } else if (isSearching && searchData) {
              statusBg = "bg-emerald-50/80 border-emerald-100/80 text-emerald-800 shadow-[0_2px_12px_rgba(16,185,129,0.03)]";
              badgeBg = "bg-emerald-100 text-emerald-600";
              pulseColor = "bg-emerald-500";
              statusTitle = "比对完成";
              statusText = `已成功比对 ${searchData.data?.total || 0} 期历史开奖数据，发现匹配号码。`;
            }
            
            return (
              <div className={`w-full py-3.5 px-5 rounded-[1.5rem] border backdrop-blur-md text-xs font-bold transition-all duration-500 ease-out flex items-center gap-3.5 shadow-sm ${statusBg}`}>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColor}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`}></span>
                </span>
                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${badgeBg}`}>
                  {statusTitle}
                </span>
                <span className="font-semibold tracking-tight truncate flex-1">{statusText}</span>
              </div>
            );
          })()}
        </div>

        {/* Content Area */}
        <div className="space-y-12">
          {/* Tickets Section */}
          {!isSearching && ticketData?.data?.list && ticketData.data.list.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 px-2">
                <div className="h-px flex-1 bg-slate-200/60" />
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">我的自动守护号码</h2>
                <div className="h-px flex-1 bg-slate-200/60" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ticketData.data.list.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="group p-6 rounded-2xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md hover:shadow-rose-500/5 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-slate-700">{ticket.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-rose-500">守护中</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.6)] animate-pulse" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ticket.numbers?.red?.map((num: string, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100/80 flex items-center justify-center text-xs font-bold text-rose-600 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600 transition-all duration-300">
                          {num}
                        </div>
                      ))}
                      <div className="w-[1px] h-5 bg-slate-200 mx-1" />
                      {ticket.numbers?.blue?.map((num: string, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-xs font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300">
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="space-y-5">
            <h2 className="text-xl font-bold tracking-tight px-1 text-slate-900">
              {isSearching ? "对奖比对结果" : "官方开奖历史数据"}
            </h2>
            
            {displayLoading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-white border border-slate-200/80 rounded-[2rem]">
                <Loader2 className="w-9 h-9 animate-spin text-rose-500" />
                <p className="text-xs font-medium text-slate-400">正在读取历史开奖数据，请稍候...</p>
              </div>
            ) : (
              <div className="relative rounded-[2.25rem] bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/60 border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-5 px-8 text-xs font-bold text-slate-500">开奖期号</TableHead>
                        <TableHead className="py-5 px-4 text-xs font-bold text-slate-500">开奖日期</TableHead>
                        <TableHead className="py-5 px-4 text-xs font-bold text-slate-500">号码球图谱（前区红球 | 后区蓝球）</TableHead>
                        <TableHead className="py-5 px-8 text-right text-xs font-bold text-slate-500">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayData?.data?.list.map((item: any) => (
                        <TableRow key={item.issueNumber} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                          <TableCell className="py-5 px-8 font-mono text-slate-900 font-bold text-xs">{item.issueNumber}</TableCell>
                          <TableCell className="py-5 px-4 text-slate-400 text-xs font-semibold">{formatDate(item.openDate)}</TableCell>
                          <TableCell className="py-5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.openNumbers?.red?.map((num: string, idx: number) => {
                                const matched = isNumberMatched(num, true);
                                const isActive = isSearching && matched;
                                return (
                                  <div
                                    key={num + idx}
                                    className={`relative w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all duration-300 ${
                                      isActive 
                                        ? "bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.4)] scale-110 z-10 font-bold" 
                                        : isSearching 
                                          ? "bg-slate-100 text-slate-400 border border-slate-200" 
                                          : "bg-rose-50/60 text-rose-600 border border-rose-100/50 hover:bg-rose-600 hover:text-white hover:shadow-[0_2px_8px_rgba(225,29,72,0.15)]"
                                    }`}
                                  >
                                    {num}
                                    {isActive && <div className="absolute -inset-0.5 bg-rose-400/20 blur-sm rounded-lg animate-pulse" />}
                                  </div>
                                );
                              })}
                              <div className="w-[1px] h-5 bg-slate-200 mx-1.5" />
                              {item.openNumbers?.blue && (() => {
                                const matched = isNumberMatched(item.openNumbers.blue, false);
                                const isActive = isSearching && matched;
                                return (
                                  <div
                                    className={`relative w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all duration-300 ${
                                      isActive 
                                        ? "bg-indigo-650 text-white shadow-[0_2px_8px_rgba(79,70,229,0.4)] scale-110 z-10 font-bold" 
                                        : isSearching 
                                          ? "bg-slate-100 text-slate-300 opacity-40 border border-slate-100" 
                                          : "bg-indigo-50/60 text-indigo-600 border border-indigo-100/50 hover:bg-indigo-650 hover:text-white hover:shadow-[0_2px_8px_rgba(79,70,229,0.15)]"
                                    }`}
                                  >
                                    {item.openNumbers.blue}
                                     {isActive && <div className="absolute -inset-0.5 bg-indigo-400/20 blur-sm rounded-lg animate-pulse" />}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="py-5 px-8 text-right">
                            <button
                              onClick={() => {
                                let prizeAmounts = item.prizeAmounts;
                                if (typeof prizeAmounts === "string" && prizeAmounts.trim()) {
                                  try { prizeAmounts = JSON.parse(prizeAmounts); } catch { prizeAmounts = null; }
                                }
                                setSelectedPrizeInfo({
                                  issueNumber: item.issueNumber,
                                  openDate: formatDate(item.openDate),
                                  prizeAmounts: prizeAmounts && Array.isArray(prizeAmounts) && prizeAmounts.length > 0 ? prizeAmounts : null,
                                });
                                setIsDialogOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all font-bold text-xs shadow-sm"
                            >
                              <span>查看详情</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Pagination Component */}
            {totalPages > 1 && !isSearching && (
              <div className="flex justify-center pt-8">
                <Pagination>
                  <PaginationContent className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <PaginationItem>
                      <PaginationPrevious
                        className="rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                        onClick={() => {
                          if (currentPage > 1) handlePageChange(currentPage - 1);
                        }}
                        style={{
                          cursor: currentPage > 1 ? "pointer" : "not-allowed",
                        }}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1),
                      )
                      .map((page, idx, arr) => (
                        <div key={page} className="flex items-center">
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <span className="text-slate-400 px-1 font-bold pb-1 text-xs">...</span>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              className={`w-8 h-8 rounded-lg transition-all font-black text-xs ${
                                currentPage === page
                                  ? "bg-rose-500 text-white hover:bg-rose-600 shadow-sm"
                                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                              }`}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </div>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        className="rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                        onClick={() => {
                          if (currentPage < totalPages) handlePageChange(currentPage + 1);
                        }}
                        style={{
                          cursor: currentPage < totalPages ? "pointer" : "not-allowed",
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            {isSearching && searchTotalPages > 1 && (
              <div className="flex justify-center pt-8">
                <Pagination>
                  <PaginationContent className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <PaginationItem>
                      <PaginationPrevious
                        className="rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                        onClick={() => {
                          if (searchCurrentPage > 1) handleSearchPageChange(searchCurrentPage - 1);
                        }}
                        style={{
                          cursor: searchCurrentPage > 1 ? "pointer" : "not-allowed",
                        }}
                      />
                    </PaginationItem>
                    {Array.from({ length: searchTotalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === searchTotalPages ||
                          (page >= searchCurrentPage - 1 && page <= searchCurrentPage + 1),
                      )
                      .map((page, idx, arr) => (
                        <div key={page} className="flex items-center">
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <span className="text-slate-400 px-1 font-bold pb-1 text-xs">...</span>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              className={`w-8 h-8 rounded-lg transition-all font-black text-xs ${
                                searchCurrentPage === page
                                  ? "bg-rose-500 text-white hover:bg-rose-600 shadow-sm"
                                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                              }`}
                              onClick={() => handleSearchPageChange(page)}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </div>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        className="rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                        onClick={() => {
                          if (searchCurrentPage < searchTotalPages) handleSearchPageChange(searchCurrentPage + 1);
                        }}
                        style={{
                          cursor: searchCurrentPage < searchTotalPages ? "pointer" : "not-allowed",
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Prize Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white/95 border border-slate-200/80 backdrop-blur-2xl shadow-2xl p-6">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <CircleDot className="w-5 h-5 text-rose-500 animate-pulse" />
              第 {selectedPrizeInfo?.issueNumber} 期开奖详情
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              开奖日期: {selectedPrizeInfo ? formatDate(selectedPrizeInfo.openDate) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">各奖级分配明细</h4>
            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
              {selectedPrizeInfo?.prizeAmounts && selectedPrizeInfo.prizeAmounts.length > 0 ? (
                selectedPrizeInfo.prizeAmounts.map((prize, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 shadow-sm transition-all hover:bg-white hover:border-slate-300">
                    <span className="text-xs font-black text-slate-700">{prize.level}</span>
                    <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 border border-rose-100/50 px-2.5 py-1 rounded-md">{prize.amount}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  暂无详细奖金分配数据
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
