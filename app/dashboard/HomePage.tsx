"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trpc } from "@/server/client";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const refreshAllMutation = trpc.refreshAll.useMutation();

  const handleRefreshAll = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await refreshAllMutation.mutateAsync();
      if (res.success) {
        const ssqCount = res.ssq?.count || 0;
        const dltCount = res.dlt?.count || 0;
        setResult(
          `一键刷新成功！双色球处理 ${ssqCount} 条，大乐透处理 ${dltCount} 条（存在则更新，不存在则新增）。`,
        );
      } else {
        setResult("刷新失败");
      }
    } catch (e) {
      setResult(`请求异常: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-white rounded-xl shadow-md border border-gray-200">
      <h1 className="text-3xl font-bold mb-4 text-blue-600">
        欢迎来到彩票开奖爬虫
      </h1>
      <p className="mb-6 text-gray-600">
        点击下方按钮进入相应的爬虫页面，获取最新的开奖信息。
      </p>
      <div className="flex gap-4 flex-wrap">
        <Link href="/lottery-crawler">
          <Button variant="default" className="text-lg px-8 py-4">
            双色球爬虫
          </Button>
        </Link>
        <Link href="/lottery-dlt-crawler">
          <Button variant="default" className="text-lg px-8 py-4">
            大乐透爬虫
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="outline" className="text-lg px-8 py-4">
            系统设置
          </Button>
        </Link>
        <Button
          variant="default"
          className="text-lg px-8 py-4 bg-green-600 hover:bg-green-700"
          onClick={handleRefreshAll}
          disabled={loading}
        >
          {loading ? "正在刷新..." : "一键刷新所有数据"}
        </Button>
      </div>
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {result}
        </div>
      )}
    </section>
  );
}
