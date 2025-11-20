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
    <div style={{ padding: 32 }}>
      <Button
        variant="outline"
        className="mb-4 px-8 py-3 rounded-full font-bold text-white shadow-lg transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-purple-500 hover:to-blue-500 hover:scale-105 border-0"
        onClick={() => router.push("/lottery-dlt-crawler")}
      >
        去大乐透爬虫
      </Button>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>双色球开奖爬虫</h1>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: 16,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            outline: "none",
          }}
        >
          <option value="all">所有年份</option>
          {Array.from(
            { length: new Date().getFullYear() - 1999 },
            (_, i) => new Date().getFullYear() - i,
          ).map((year) => (
            <option key={year} value={year}>
              {year}年
            </option>
          ))}
        </select>
        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            padding: "8px 24px",
            fontSize: 18,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "正在爬取..." : "启动爬虫"}
        </button>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索号码（7个号码，空格或逗号分隔）"
          style={{
            width: 250,
            padding: "8px 12px",
            fontSize: 16,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            outline: "none",
          }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={isExactMatch}
            onChange={(e) => setIsExactMatch(e.target.checked)}
            style={{
              width: 16,
              height: 16,
              cursor: "pointer",
            }}
          />
          <span>全匹配</span>
        </label>
        <button
          onClick={handleSearch}
          disabled={searchLoading}
          style={{
            padding: "8px 24px",
            fontSize: 16,
            background: "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: searchLoading ? "not-allowed" : "pointer",
          }}
        >
          {searchLoading ? "搜索中..." : "搜索"}
        </button>
        {isSearching && (
          <button
            onClick={handleClearSearch}
            style={{
              padding: "8px 24px",
              fontSize: 16,
              background: "#6b7280",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            清除搜索
          </button>
        )}
      </div>
      {result && <div style={{ marginTop: 24, fontSize: 16 }}>{result}</div>}
      {isSearching && searchData && (
        <div style={{ marginTop: 16, fontSize: 16, color: "#059669" }}>
          找到 {searchData.data?.total || 0} 条匹配记录
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>
          {isSearching ? "搜索结果" : "开奖历史"}
        </h2>
        {displayLoading ? (
          <div>加载中...</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>期号</TableHead>
                    <TableHead>开奖日期</TableHead>
                    <TableHead>开奖号码</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData?.data?.list.map((item: any) => (
                    <TableRow key={item.issueNumber}>
                      <TableCell>{item.issueNumber}</TableCell>
                      <TableCell>{formatDate(item.openDate)}</TableCell>
                      <TableCell>
                        {item.openNumbers?.red?.map(
                          (num: string, idx: number) => {
                            const matched = isNumberMatched(num, true);
                            // 在搜索模式下，根据匹配状态设置样式
                            const bgColor = isSearching
                              ? matched
                                ? "#e53e3e"
                                : "#fff"
                              : "#e53e3e";
                            const textColor = isSearching
                              ? matched
                                ? "#fff"
                                : "#000"
                              : "#fff";
                            const borderStyle = isSearching
                              ? matched
                                ? "none"
                                : "1px solid #e2e8f0"
                              : "none";
                            return (
                              <span
                                key={num + idx}
                                style={{
                                  display: "inline-block",
                                  width: 28,
                                  height: 28,
                                  lineHeight: "28px",
                                  borderRadius: "50%",
                                  background: bgColor,
                                  color: textColor,
                                  border: borderStyle,
                                  textAlign: "center",
                                  marginRight: 4,
                                  fontWeight: 600,
                                }}
                              >
                                {num}
                              </span>
                            );
                          },
                        )}
                        {item.openNumbers?.blue &&
                          (() => {
                            const blueMatched = isNumberMatched(
                              item.openNumbers.blue,
                              false,
                            );
                            // 在搜索模式下，根据匹配状态设置样式
                            const bgColor = isSearching
                              ? blueMatched
                                ? "#2563eb"
                                : "#fff"
                              : "#2563eb";
                            const textColor = isSearching
                              ? blueMatched
                                ? "#fff"
                                : "#000"
                              : "#fff";
                            const borderStyle = isSearching
                              ? blueMatched
                                ? "none"
                                : "1px solid #e2e8f0"
                              : "none";
                            return (
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 28,
                                  height: 28,
                                  lineHeight: "28px",
                                  borderRadius: "50%",
                                  background: bgColor,
                                  color: textColor,
                                  border: borderStyle,
                                  textAlign: "center",
                                  marginLeft: 8,
                                  fontWeight: 600,
                                }}
                              >
                                {item.openNumbers.blue}
                              </span>
                            );
                          })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      size="default"
                      onClick={() => {
                        if (isSearching) {
                          if (searchCurrentPage > 1) {
                            handleSearchPageChange(searchCurrentPage - 1);
                          }
                        } else {
                          if (currentPage > 1) {
                            handlePageChange(currentPage - 1);
                          }
                        }
                      }}
                      style={{
                        cursor: (
                          isSearching ? searchCurrentPage > 1 : currentPage > 1
                        )
                          ? "pointer"
                          : "not-allowed",
                        opacity: (
                          isSearching ? searchCurrentPage > 1 : currentPage > 1
                        )
                          ? 1
                          : 0.5,
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink
                      size="default"
                      onClick={() =>
                        isSearching
                          ? handleSearchPageChange(1)
                          : handlePageChange(1)
                      }
                      isActive={
                        isSearching
                          ? searchCurrentPage === 1
                          : currentPage === 1
                      }
                      style={{ cursor: "pointer" }}
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                  {(isSearching ? searchCurrentPage > 4 : currentPage > 4) && (
                    <PaginationItem>
                      <PaginationLink size="default">...</PaginationLink>
                    </PaginationItem>
                  )}
                  {Array.from(
                    {
                      length: isSearching ? searchTotalPages : totalPages,
                    },
                    (_, i) => i + 1,
                  )
                    .filter((page) => {
                      const current = isSearching
                        ? searchCurrentPage
                        : currentPage;
                      return (
                        page !== 1 &&
                        page !==
                          (isSearching ? searchTotalPages : totalPages) &&
                        page >= current - 1 &&
                        page <= current + 1
                      );
                    })
                    .map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          size="default"
                          onClick={() =>
                            isSearching
                              ? handleSearchPageChange(page)
                              : handlePageChange(page)
                          }
                          isActive={
                            isSearching
                              ? searchCurrentPage === page
                              : currentPage === page
                          }
                          style={{ cursor: "pointer" }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  {(isSearching
                    ? searchCurrentPage < searchTotalPages - 3
                    : currentPage < totalPages - 3) && (
                    <PaginationItem>
                      <PaginationLink size="default">...</PaginationLink>
                    </PaginationItem>
                  )}
                  {(isSearching ? searchTotalPages : totalPages) > 1 && (
                    <PaginationItem>
                      <PaginationLink
                        size="default"
                        onClick={() =>
                          isSearching
                            ? handleSearchPageChange(searchTotalPages)
                            : handlePageChange(totalPages)
                        }
                        isActive={
                          isSearching
                            ? searchCurrentPage === searchTotalPages
                            : currentPage === totalPages
                        }
                        style={{ cursor: "pointer" }}
                      >
                        {isSearching ? searchTotalPages : totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationNext
                      size="default"
                      onClick={() => {
                        if (isSearching) {
                          if (searchCurrentPage < searchTotalPages) {
                            handleSearchPageChange(searchCurrentPage + 1);
                          }
                        } else {
                          if (currentPage < totalPages) {
                            handlePageChange(currentPage + 1);
                          }
                        }
                      }}
                      style={{
                        cursor: (
                          isSearching
                            ? searchCurrentPage < searchTotalPages
                            : currentPage < totalPages
                        )
                          ? "pointer"
                          : "not-allowed",
                        opacity: (
                          isSearching
                            ? searchCurrentPage < searchTotalPages
                            : currentPage < totalPages
                        )
                          ? 1
                          : 0.5,
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
