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
import { Button } from "../../components/ui/button";
import { useRouter } from "next/navigation";
import { trpc } from "../../server/client";
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
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [searchInput, setSearchInput] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [isExactMatch, setIsExactMatch] = useState(false);
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
        setResult("失败");
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
      setResult("请输入至少1个号码进行搜索（用空格或逗号分隔）");
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
    setSearchCurrentPage(1);
    setResult(null);
  };

  // 决定显示哪个数据源
  const displayData = isSearching ? searchData : data;
  const displayLoading = isSearching ? searchLoading : listLoading;

  // 缓存搜索号码列表（区分红球和蓝球）
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
      // 非搜索模式，都显示为匹配（红色/蓝色）
      return true;
    }
    // 统一格式为两位数字字符串
    const numStr = typeof num === "string" ? num : num.toString();
    const numValue = parseInt(numStr, 10);
    if (isNaN(numValue)) return false;
    const normalizedNum = numValue.toString().padStart(2, "0");

    if (isRed) {
      // 红球只匹配搜索的红球号码
      return searchRedNumbersSet.has(normalizedNum);
    } else {
      // 蓝球只匹配搜索的蓝球号码
      return searchBlueNumber === normalizedNum;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-red-500/30">
      {/* 氛围背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto p-4 md:p-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] uppercase tracking-[0.2em] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              核心数据处理节点
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white">
              双色球 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-orange-500">开奖引擎</span>
            </h1>
            <p className="text-slate-500 text-lg font-light max-w-md">
              双色球开奖数据深度追踪与模式干预分析系统
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => router.push("/lottery-dlt-crawler")}
              className="group relative px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span className="relative flex items-center gap-2">
                切换大乐透节点 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              设置中心
            </button>
          </div>
        </header>

        {/* Control Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
          {/* Main Controls */}
          <section className="lg:col-span-3 p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/[0.06] backdrop-blur-2xl shadow-2xl space-y-8">
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1.5 min-w-[120px]">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">数据年度</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-black/40 border border-white/10 text-white outline-none cursor-pointer focus:border-red-500/50 transition-all appearance-none"
                >
                  {Array.from(
                    { length: new Date().getFullYear() - 1999 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((year) => (
                    <option key={year} value={year} className="bg-slate-900">
                      {year} 年度
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-3 flex-1">
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="flex-1 h-12 px-6 rounded-xl bg-white text-black font-bold hover:bg-slate-200 disabled:opacity-50 transition-all shadow-xl active:scale-[0.98]"
                >
                  {loading ? "正在抓取数据..." : "启动抓取任务"}
                </button>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-500 group-focus-within:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="在此输入模式检索号码 (空格或逗号分隔)"
                className="w-full h-14 pl-12 pr-32 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-red-500/50 focus:bg-black/60 transition-all text-lg"
              />
              <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                 <button
                  onClick={handleClearSearch}
                  className={`h-full px-4 rounded-xl text-xs font-bold transition-all ${isSearching ? 'bg-red-500/20 text-red-500 opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  重置
                </button>
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="h-full px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black tracking-widest disabled:opacity-50"
                >
                  {searchLoading ? "搜索中" : "开始检索"}
                </button>
               
              </div>
            </div>

            <div className="flex items-center gap-4 px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-6 flex items-center rounded-full transition-colors ${isExactMatch ? 'bg-red-500' : 'bg-slate-800'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform transform mx-1 ${isExactMatch ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <input
                  type="checkbox"
                  checked={isExactMatch}
                  onChange={(e) => setIsExactMatch(e.target.checked)}
                  className="hidden"
                />
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300 transition-colors tracking-tight uppercase">完全匹配模式 (严格搜索)</span>
              </label>
            </div>
          </section>

          {/* Side Info Cards */}
          <aside className="space-y-6">
            <div className="p-6 rounded-[2rem] bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 backdrop-blur-xl">
              <h3 className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">系统反馈</h3>
              {result ? (
                <p className="text-sm font-medium leading-relaxed italic text-red-200">"{result}"</p>
              ) : (
                <p className="text-sm text-slate-500 italic">等待系统指令下达...</p>
              )}
            </div>

            {isSearching && searchData && (
              <div className="p-6 rounded-[2rem] bg-emerald-500/20 border border-emerald-500/20 backdrop-blur-xl animate-in zoom-in-95 duration-500">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">检索完成</h3>
                <div className="text-3xl font-black text-white">{searchData.data?.total || 0}</div>
                <p className="text-[10px] text-emerald-400/70 uppercase tracking-tighter mt-1">发现匹配的数据模式</p>
              </div>
            )}
          </aside>
        </div>

        {/* Content Area */}
        <div className="space-y-12">
          {/* Tickets Section */}
          {!isSearching && ticketData?.data?.list && ticketData.data.list.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <div className="h-px flex-1 bg-white/10" />
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">活跃干预模型</h2>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ticketData.data.list.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="group p-5 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:border-red-500/30 hover:bg-white/[0.04] transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{ticket.name}</span>
                      <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.numbers?.red?.map((num: string, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[10px] font-black text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                          {num}
                        </div>
                      ))}
                      <div className="w-px h-6 bg-white/10 mx-1" />
                      {ticket.numbers?.blue?.map((num: string, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
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
          <div className="space-y-6">
            <h2 className="text-2xl font-black tracking-tight px-2 text-white">
              {isSearching ? "模式分析报告" : "历史开奖记录"}
            </h2>
            
            {displayLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-12 h-12 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">正在访问加密数据记录...</p>
              </div>
            ) : (
              <div className="relative rounded-[2.5rem] bg-white/[0.01] border border-white/[0.06] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white/[0.02]">
                      <TableRow className="border-white/[0.05] hover:bg-transparent">
                        <TableHead className="py-6 px-8 text-xs font-black text-slate-500 uppercase tracking-widest">开奖期号</TableHead>
                        <TableHead className="py-6 px-4 text-xs font-black text-slate-500 uppercase tracking-widest">开奖日期</TableHead>
                        <TableHead className="py-6 px-4 text-xs font-black text-slate-500 uppercase tracking-widest">号码图谱</TableHead>
                        <TableHead className="py-6 px-8 text-right text-xs font-black text-slate-500 uppercase tracking-widest">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayData?.data?.list.map((item: any) => (
                        <TableRow key={item.issueNumber} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                          <TableCell className="py-6 px-8 font-mono text-white/90 font-bold">{item.issueNumber}</TableCell>
                          <TableCell className="py-6 px-4 text-slate-500 text-sm">{formatDate(item.openDate)}</TableCell>
                          <TableCell className="py-6 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.openNumbers?.red?.map((num: string, idx: number) => {
                                const matched = isNumberMatched(num, true);
                                const isActive = isSearching && matched;
                                return (
                                  <div
                                    key={num + idx}
                                    className={`relative w-9 h-9 flex items-center justify-center rounded-xl text-sm font-black transition-all duration-500 ${
                                      isActive 
                                        ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-110 z-10" 
                                        : isSearching 
                                          ? "bg-slate-900/50 text-slate-700 opacity-40" 
                                          : "bg-white/5 text-red-500/80 border border-white/5"
                                    }`}
                                  >
                                    {num}
                                    {isActive && <div className="absolute -inset-0.5 bg-red-400/20 blur-sm rounded-xl animate-pulse" />}
                                  </div>
                                );
                              })}
                              <div className="w-px h-6 bg-white/10 mx-1" />
                              {item.openNumbers?.blue && (() => {
                                const matched = isNumberMatched(item.openNumbers.blue, false);
                                const isActive = isSearching && matched;
                                return (
                                  <div
                                    className={`relative w-9 h-9 flex items-center justify-center rounded-xl text-sm font-black transition-all duration-500 ${
                                      isActive 
                                        ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] scale-110 z-10" 
                                        : isSearching 
                                          ? "bg-slate-900/50 text-slate-700 opacity-40" 
                                          : "bg-white/5 text-indigo-400 border border-white/5"
                                    }`}
                                  >
                                    {item.openNumbers.blue}
                                     {isActive && <div className="absolute -inset-0.5 bg-indigo-400/20 blur-sm rounded-xl animate-pulse" />}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="py-6 px-8 text-right">
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
                              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all"
                            >
                              详情
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {!displayLoading && (isSearching ? searchTotalPages : totalPages) > 1 && (
              <div className="flex justify-center pt-8">
                <Pagination>
                  <PaginationContent className="bg-white/5 p-1 rounded-2xl border border-white/5">
                    <PaginationItem>
                      <PaginationPrevious
                        className="rounded-xl hover:bg-white/10 text-white disabled:opacity-30"
                        onClick={() => {
                          const current = isSearching ? searchCurrentPage : currentPage;
                          if (current > 1) isSearching ? handleSearchPageChange(current - 1) : handlePageChange(current - 1);
                        }}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: isSearching ? searchTotalPages : totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        const current = isSearching ? searchCurrentPage : currentPage;
                        const total = isSearching ? searchTotalPages : totalPages;
                        return page === 1 || page === total || (page >= current - 1 && page <= current + 1);
                      })
                      .map((page, idx, arr) => (
                        <div key={page} className="flex items-center">
                          {idx > 0 && arr[idx-1] !== page - 1 && <span className="text-slate-600 px-2">...</span>}
                          <PaginationItem>
                            <PaginationLink
                              className={`w-10 h-10 rounded-xl transition-all font-bold ${
                                (isSearching ? searchCurrentPage : currentPage) === page 
                                  ? "bg-white text-black hover:bg-white" 
                                  : "text-slate-500 hover:bg-white/10 hover:text-white"
                              }`}
                              onClick={() => isSearching ? handleSearchPageChange(page) : handlePageChange(page)}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </div>
                      ))}

                    <PaginationItem>
                      <PaginationNext
                        className="rounded-xl hover:bg-white/10 text-white disabled:opacity-30"
                        onClick={() => {
                          const current = isSearching ? searchCurrentPage : currentPage;
                          const total = isSearching ? searchTotalPages : totalPages;
                          if (current < total) isSearching ? handleSearchPageChange(current + 1) : handlePageChange(current + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>

        {/* Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md bg-[#0a0a0c] border border-white/10 p-0 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="p-8 pb-4">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-white tracking-tight">奖项详细统计</DialogTitle>
                <DialogDescription className="text-slate-500 font-mono text-xs uppercase tracking-widest mt-1">
                  期号: {selectedPrizeInfo?.issueNumber} / {selectedPrizeInfo?.openDate}
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="p-8 pt-4 space-y-4">
              <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {selectedPrizeInfo?.prizeAmounts && selectedPrizeInfo.prizeAmounts.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPrizeInfo.prizeAmounts.map((prize: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-5 bg-white/[0.03] rounded-[1.5rem] border border-white/5 hover:border-red-500/20 transition-colors group">
                        <div className="space-y-1">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">奖项能级</div>
                          <div className="text-sm font-bold text-white group-hover:text-red-400 transition-colors tracking-tight">{prize.level}</div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">单注金额</div>
                          <div className="text-xl font-black text-white tracking-tighter">
                            {prize.amount ? `${parseInt(prize.amount).toLocaleString()}` : "待定"}
                            <span className="text-[10px] text-slate-500 ml-1 font-bold">元</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center rounded-[1.5rem] bg-white/[0.02] border border-white/5 border-dashed">
                    <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">暂无采集数据</p>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setIsDialogOpen(false)}
                className="w-full h-14 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-200 transition-all mt-4"
              >
                关闭视图
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );


}
