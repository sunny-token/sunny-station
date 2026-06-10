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
import {
  Settings2,
  ArrowLeft,
  Download,
  Plus,
  Activity,
  Mail,
  Database,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Moon,
  Zap,
  Trash2,
  Edit3,
  LogOut,
} from "lucide-react";
import { formatDate } from "../../lib/utils";
import { useRouter } from "next/navigation";
import { trpc } from "../../server/client";
import LotteryNumbersInput from "@/components/LotteryNumbersInput";

export default function SettingsPage() {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tickets" | "emails">("tickets");

  // 预设号码相关状态
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);
  const [ticketLotteryType, setTicketLotteryType] = useState<"ssq" | "dlt">(
    "ssq",
  );
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [ticketName, setTicketName] = useState("");
  const [ticketRedNumbers, setTicketRedNumbers] = useState<string[]>([]);
  const [ticketBlueNumbers, setTicketBlueNumbers] = useState<string[]>([]);
  const [ticketIsActive, setTicketIsActive] = useState(true);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [ticketBatchText, setTicketBatchText] = useState("");


  // 邮箱相关状态
  const [emailPage, setEmailPage] = useState(1);
  const [emailTotalPages, setEmailTotalPages] = useState(1);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [editingEmail, setEditingEmail] = useState<any>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailIsActive, setEmailIsActive] = useState(true);

  // 认证状态 hooks
  const { data: user } = trpc.auth.getMe.useQuery();
  const isAdmin = user?.role === "ADMIN";
  const isGuest = user?.role === "GUEST";

  // 预设号码相关 hooks
  const {
    data: ticketData,
    isLoading: ticketLoading,
    refetch: refetchTickets,
  } = trpc.ticket.getList.useQuery({
    page: ticketPage,
    pageSize: 10,
  });

  const createTicketMutation = trpc.ticket.create.useMutation();
  const updateTicketMutation = trpc.ticket.update.useMutation();
  const deleteTicketMutation = trpc.ticket.delete.useMutation();
  const batchImportMutation = trpc.ticket.batchImport.useMutation();

  // 批量导入相关状态
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // 邮箱相关 hooks
  const {
    data: emailData,
    isLoading: emailLoading,
    refetch: refetchEmails,
  } = trpc.email.getList.useQuery({
    page: emailPage,
    pageSize: 10,
  });

  const createEmailMutation = trpc.email.create.useMutation();
  const updateEmailMutation = trpc.email.update.useMutation();
  const deleteEmailMutation = trpc.email.delete.useMutation();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
  });

  useEffect(() => {
    if (ticketData?.data?.total) {
      setTicketTotalPages(Math.ceil(ticketData.data.total / 10));
    }
  }, [ticketData]);

  // 按类型分组预设号码
  const groupedTickets = useMemo(() => {
    if (!ticketData?.data?.list) {
      return { ssq: [], dlt: [] };
    }
    const ssq: any[] = [];
    const dlt: any[] = [];
    ticketData.data.list.forEach((ticket: any) => {
      if (ticket.lotteryType === "ssq") {
        ssq.push(ticket);
      } else {
        dlt.push(ticket);
      }
    });
    return { ssq, dlt };
  }, [ticketData]);

  useEffect(() => {
    if (emailData?.data?.total) {
      setEmailTotalPages(Math.ceil(emailData.data.total / 10));
    }
  }, [emailData]);

  // 当编辑票时，根据类型设置号码输入框
  useEffect(() => {
    if (editingTicket && activeTab === "tickets") {
      const type = editingTicket.lotteryType;
      setTicketLotteryType(type);
      // 保持现有号码，但确保数组长度正确
      const redNums = [...editingTicket.numbers.red];
      const blueNums = [...editingTicket.numbers.blue];
      if (type === "ssq") {
        while (redNums.length < 6) redNums.push("");
        while (redNums.length > 6) redNums.pop();
        while (blueNums.length < 1) blueNums.push("");
        while (blueNums.length > 1) blueNums.pop();
      } else {
        while (redNums.length < 5) redNums.push("");
        while (redNums.length > 5) redNums.pop();
        while (blueNums.length < 2) blueNums.push("");
        while (blueNums.length > 2) blueNums.pop();
      }
      setTicketRedNumbers(redNums);
      setTicketBlueNumbers(blueNums);
    }
  }, [editingTicket, activeTab]);

  // 预设号码管理函数
  const handleAddTicket = () => {
    setEditingTicket(null);
    setTicketName("");
    setTicketLotteryType("ssq"); // 默认双色球
    setTicketRedNumbers(["", "", "", "", "", ""]);
    setTicketBlueNumbers([""]);
    setTicketIsActive(true);
    setIsBatchMode(false);
    setTicketBatchText("");
    setShowTicketForm(true);
  };

  const handleEditTicket = (ticket: any) => {
    setEditingTicket(ticket);
    setTicketName(ticket.name);
    setTicketLotteryType(ticket.lotteryType);
    setTicketRedNumbers([...ticket.numbers.red]);
    setTicketBlueNumbers([...ticket.numbers.blue]);
    setTicketIsActive(ticket.isActive);
    setIsBatchMode(false);
    setTicketBatchText("");
    setShowTicketForm(true);
  };

  const handleSaveTicket = async () => {
    if (!ticketName.trim()) {
      setResult("请输入预设号码名称");
      return;
    }

    try {
      if (isBatchMode && !editingTicket) {
        const lines = ticketBatchText.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
          setResult("请输入号码");
          return;
        }

        const promises = lines.map(async (line, index) => {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length !== 2) throw new Error(`第 ${index + 1} 行格式不正确，缺少 '|' 分隔符`);
          
          const redNums = parts[0].split(/\s+/).filter(n => n.trim() !== '');
          const blueNums = parts[1].split(/\s+/).filter(n => n.trim() !== '');

          if (ticketLotteryType === "ssq") {
            if (redNums.length !== 6) throw new Error(`第 ${index + 1} 行红球数量错误，应为6个`);
            if (blueNums.length !== 1) throw new Error(`第 ${index + 1} 行蓝球数量错误，应为1个`);
          } else {
            if (redNums.length !== 5) throw new Error(`第 ${index + 1} 行红球数量错误，应为5个`);
            if (blueNums.length !== 2) throw new Error(`第 ${index + 1} 行蓝球数量错误，应为2个`);
          }

          const numbers = {
            red: redNums.map(n => parseInt(n, 10).toString().padStart(2, "0")),
            blue: blueNums.map(n => parseInt(n, 10).toString().padStart(2, "0")),
          };

          const name = lines.length > 1 ? `${ticketName.trim()}_${index + 1}` : ticketName.trim();

          return createTicketMutation.mutateAsync({
            lotteryType: ticketLotteryType,
            name,
            numbers,
            isActive: ticketIsActive,
          });
        });

        await Promise.all(promises);
        setResult(`成功添加 ${lines.length} 注预设号码`);
      } else {
        const redNums = ticketRedNumbers.filter((n) => n.trim() !== "");
        const blueNums = ticketBlueNumbers.filter((n) => n.trim() !== "");

        if (ticketLotteryType === "ssq") {
          if (redNums.length !== 6) {
            setResult("双色球需要6个红球号码");
            return;
          }
          if (blueNums.length !== 1) {
            setResult("双色球需要1个蓝球号码");
            return;
          }
        } else {
          if (redNums.length !== 5) {
            setResult("大乐透需要5个红球号码");
            return;
          }
          if (blueNums.length !== 2) {
            setResult("大乐透需要2个蓝球号码");
            return;
          }
        }

        const numbers = {
          red: redNums.map((n) =>
            parseInt(n.trim(), 10).toString().padStart(2, "0"),
          ),
          blue: blueNums.map((n) =>
            parseInt(n.trim(), 10).toString().padStart(2, "0"),
          ),
        };

        if (editingTicket) {
          await updateTicketMutation.mutateAsync({
            id: editingTicket.id,
            name: ticketName.trim(),
            numbers,
            isActive: ticketIsActive,
          });
          setResult("预设号码更新成功");
        } else {
          await createTicketMutation.mutateAsync({
            lotteryType: ticketLotteryType,
            name: ticketName.trim(),
            numbers,
            isActive: ticketIsActive,
          });
          setResult("预设号码添加成功");
        }
      }
      setShowTicketForm(false);
      refetchTickets();
    } catch (e) {
      setResult(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteTicket = async (id: number) => {
    if (!confirm("确定要删除这个预设号码吗？")) {
      return;
    }
    try {
      await deleteTicketMutation.mutateAsync({ id });
      setResult("预设号码删除成功");
      refetchTickets();
    } catch (e) {
      setResult(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleToggleTicketActive = async (ticket: any) => {
    try {
      await updateTicketMutation.mutateAsync({
        id: ticket.id,
        isActive: !ticket.isActive,
      });
      setResult(`预设号码已${!ticket.isActive ? "激活" : "停用"}`);
      refetchTickets();
    } catch (e) {
      setResult(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 邮箱管理函数
  const handleAddEmail = () => {
    setEditingEmail(null);
    setEmailAddress("");
    setEmailName("");
    setEmailIsActive(true);
    setShowEmailForm(true);
  };

  const handleEditEmail = (email: any) => {
    setEditingEmail(email);
    setEmailAddress(email.email);
    setEmailName(email.name || "");
    setEmailIsActive(email.isActive);
    setShowEmailForm(true);
  };

  const handleSaveEmail = async () => {
    if (!emailAddress.trim()) {
      setResult("请输入邮箱地址");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      setResult("请输入有效的邮箱地址");
      return;
    }

    try {
      if (editingEmail) {
        await updateEmailMutation.mutateAsync({
          id: editingEmail.id,
          email: emailAddress.trim(),
          name: emailName.trim() || undefined,
          isActive: emailIsActive,
        });
        setResult("邮箱更新成功");
      } else {
        await createEmailMutation.mutateAsync({
          email: emailAddress.trim(),
          name: emailName.trim() || undefined,
          isActive: emailIsActive,
        });
        setResult("邮箱添加成功");
      }
      setShowEmailForm(false);
      refetchEmails();
    } catch (e) {
      setResult(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteEmail = async (id: number) => {
    if (!confirm("确定要删除这个邮箱吗？")) {
      return;
    }
    try {
      await deleteEmailMutation.mutateAsync({ id });
      setResult("邮箱删除成功");
      refetchEmails();
    } catch (e) {
      setResult(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleToggleEmailActive = async (email: any) => {
    try {
      await updateEmailMutation.mutateAsync({
        id: email.id,
        isActive: !email.isActive,
      });
      setResult(`邮箱已${!email.isActive ? "激活" : "停用"}`);
      refetchEmails();
    } catch (e) {
      setResult(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 批量导入处理函数
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
        "text/csv", // .csv
      ];

      if (
        !validTypes.includes(file.type) &&
        !file.name.match(/\.(xlsx|xls|csv)$/i)
      ) {
        setResult("请选择 Excel 文件（.xlsx, .xls）或 CSV 文件");
        return;
      }

      setImportFile(file);
      setResult(null);
    }
  };

  const handleBatchImport = async () => {
    if (!importFile) {
      setResult("请先选择要导入的 Excel 文件");
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      // 读取文件并转换为 base64
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            throw new Error("文件读取失败");
          }

          // 转换为 base64
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          // 调用批量导入 API
          const response = await batchImportMutation.mutateAsync({
            fileData: base64,
            isActive: true,
          });

          if (response.success) {
            const {
              total,
              created,
              skipped,
              fileDuplicates,
              dbDuplicates,
              typeSummary,
              newTypeSummary,
              sheetSummary,
              errors,
            } = response.data;
            let message = `批量导入完成！\n总计: ${total} 条（去重后）\n成功导入: ${created} 条\n跳过: ${skipped} 条`;

            if (fileDuplicates > 0 || dbDuplicates > 0) {
              message += `\n\n去重统计：`;
              if (fileDuplicates > 0) {
                message += `\n- 文件内重复: ${fileDuplicates} 条`;
              }
              if (dbDuplicates > 0) {
                message += `\n- 数据库已存在: ${dbDuplicates} 条`;
              }
            }

            if (typeSummary) {
              message += `\n\n类型统计（去重后）：\n- 双色球: ${typeSummary.ssq} 条\n- 大乐透: ${typeSummary.dlt} 条`;
            }

            if (newTypeSummary) {
              message += `\n\n新导入统计：\n- 双色球: ${newTypeSummary.ssq} 条\n- 大乐透: ${newTypeSummary.dlt} 条`;
            }

            if (sheetSummary && Object.keys(sheetSummary).length > 0) {
              message += `\n\n工作表统计：`;
              Object.entries(sheetSummary).forEach(([sheet, stats]) => {
                message += `\n- ${sheet}: ${stats.total} 条`;
              });
            }

            if (errors && errors.length > 0) {
              message += `\n\n错误信息:\n${errors.slice(0, 10).join("\n")}`;
              if (errors.length > 10) {
                message += `\n... 还有 ${errors.length - 10} 条错误信息`;
              }
            }

            setResult(message);
            setImportFile(null);

            // 重置文件输入
            const fileInput = document.getElementById(
              "import-file-input",
            ) as HTMLInputElement;
            if (fileInput) {
              fileInput.value = "";
            }

            // 刷新列表
            refetchTickets();
          }
        } catch (error) {
          setResult(
            `导入失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        setResult("文件读取失败，请重试");
        setIsImporting(false);
      };

      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      setResult(
        `导入失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 selection:bg-indigo-500/20 font-sans relative overflow-x-hidden">
      {/* 氛围背景微网格与渐变 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.05),transparent_70%)]" />
        <div className="absolute top-1/3 right-0 w-[600px] h-[600px] bg-purple-500/[0.02] blur-[150px] rounded-full pointer-events-none" />
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto p-6 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Navigation & Header */}
        <header className="mb-12 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <button
              onClick={() => router.push("/")}
              className="group flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-sm hover:border-slate-300 transition-all duration-300 font-medium"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-semibold tracking-tight">返回控制中心</span>
            </button>
            
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="group flex items-center gap-2 px-4.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:text-white hover:bg-rose-600 hover:border-rose-600 shadow-sm active:scale-[0.98] transition-all duration-300 font-semibold"
            >
              <span className="text-sm tracking-tight">
                {logoutMutation.isPending ? "登出中..." : "安全登出"}
              </span>
              <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-wider">
                <Settings2 className="w-3.5 h-3.5" />
                系统配置中心
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
                全局{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                  参数配置
                </span>
              </h1>
              <p className="text-slate-500 text-base font-light max-w-xl leading-relaxed">
                管理全局号码监控策略、通知邮箱及其订阅状态。配置变更将实时同步至对奖核心。
              </p>
            </div>
          </div>
        </header>

        {/* Global Feedback */}
        {result && (
          <div
            className={`p-4.5 rounded-2xl mb-8 flex items-start gap-3.5 border backdrop-blur-xl shadow-md animate-in zoom-in-95 duration-300 ${
              result.includes("成功") || result.includes("完成")
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {result.includes("成功") || result.includes("完成") ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-bold tracking-tight whitespace-pre-line leading-relaxed">
                {result}
              </p>
            </div>
          </div>
        )}

        {/* Tab System */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 p-1.5 rounded-2xl bg-slate-200/50 border border-slate-200 backdrop-blur-xl">
          <button
            onClick={() => setActiveTab("tickets")}
            className={`group relative flex items-center justify-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 overflow-hidden ${
              activeTab === "tickets"
                ? "bg-white text-indigo-600 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 font-bold"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Zap
              className={`w-5 h-5 transition-transform duration-300 ${activeTab === "tickets" ? "scale-110 text-indigo-600" : "group-hover:scale-110 text-slate-400"}`}
            />
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-wider leading-none">
                监控策略
              </div>
              <div className="text-[10px] font-semibold opacity-60 uppercase mt-1">
                管理预设号码
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("emails")}
            className={`group relative flex items-center justify-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 overflow-hidden ${
              activeTab === "emails"
                ? "bg-white text-emerald-600 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 font-bold"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Mail
              className={`w-5 h-5 transition-transform duration-300 ${activeTab === "emails" ? "scale-110 text-emerald-600" : "group-hover:scale-110 text-slate-400"}`}
            />
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-wider leading-none">
                通知配置
              </div>
              <div className="text-[10px] font-semibold opacity-60 uppercase mt-1">
                邮件提醒配置
              </div>
            </div>
          </button>
        </div>

        {/* 预设号码管理 */}
        {activeTab === "tickets" && (
          <div className="animate-in fade-in zoom-in-98 duration-500 space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 rounded-[2rem] bg-white border border-slate-200/80 shadow-sm backdrop-blur-xl gap-6">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Database className="w-5.5 h-5.5" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                    策略节点
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    预设号码监控及对奖模型
                  </p>
                </div>
              </div>

              {user && (
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <a
                    href="/批量导入模板.xlsx"
                    download
                    className="group px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all flex items-center gap-2 text-xs font-bold"
                  >
                    <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                    <span>下载模板</span>
                  </a>

                  <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex-1 lg:flex-none">
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      disabled={isGuest}
                      className="hidden"
                    />
                    <label
                      htmlFor="import-file-input"
                      className={`px-4 py-2 text-xs font-bold bg-white text-slate-700 rounded-lg shadow-sm border border-slate-200 transition-all flex items-center gap-2 ${isGuest ? "cursor-not-allowed opacity-50 text-slate-400 shadow-none border-slate-200/60" : "hover:bg-slate-50 cursor-pointer"}`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      {isGuest ? "🔒 选择文件(只读)" : "选择文件"}
                    </label>
                    {importFile && (
                      <div className="flex items-center gap-2 ml-2 animate-in slide-in-from-left-2">
                        <span className="text-[10px] font-mono text-indigo-600 max-w-[120px] truncate font-bold">
                          {importFile.name}
                        </span>
                        <button
                          onClick={handleBatchImport}
                          disabled={isImporting || isGuest}
                          className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-50 shadow-sm"
                        >
                          {isImporting ? "正在同步" : isGuest ? "🔒 访客只读" : "执行导入"}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleAddTicket}
                    disabled={isGuest}
                    className={`px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 text-xs font-black flex-1 lg:flex-none justify-center ${isGuest ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"}`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isGuest ? "🔒 访客只读" : "新增号码策略"}</span>
                  </button>
                </div>
              )}
            </div>

            {showTicketForm && (
              <div className="p-6 md:p-10 rounded-[2rem] bg-white border border-slate-200 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-500 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/[0.02] blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none" />

                <div className="relative z-10 space-y-8">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div className="space-y-0.5">
                      <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">
                        {editingTicket ? "编辑策略信息" : "新增号码策略"}
                      </h3>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                        MONITORING STRATEGY CONFIG
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        运行正常
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                          彩票类型
                        </label>
                        <select
                          value={ticketLotteryType}
                          onChange={(e) => {
                            const newType = e.target.value as "ssq" | "dlt";
                            setTicketLotteryType(newType);
                            setTicketRedNumbers(
                              newType === "ssq"
                                ? ["", "", "", "", "", ""]
                                : ["", "", "", "", ""],
                            );
                            setTicketBlueNumbers(
                              newType === "ssq" ? [""] : ["", ""],
                            );
                          }}
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer font-bold tracking-tight text-sm shadow-sm"
                        >
                          <option value="ssq">双色球 (标准版)</option>
                          <option value="dlt">大乐透 (超级版)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                          策略名称 / 备注
                        </label>
                        <input
                          type="text"
                          value={ticketName}
                          onChange={(e) => setTicketName(e.target.value)}
                          placeholder="例：策略模型_A"
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-300 font-bold tracking-tight text-sm shadow-sm"
                        />
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                              启用号码监控
                            </div>
                            <div className="text-[9px] text-slate-400 font-medium tracking-tight uppercase">
                              开奖后由对奖引擎自动计算匹配结果
                            </div>
                          </div>
                          <label className="flex items-center cursor-pointer">
                            <div
                              className={`w-12 h-6 flex items-center rounded-full transition-all duration-300 ${ticketIsActive ? "bg-indigo-600 shadow-sm" : "bg-slate-300"}`}
                            >
                              <div
                                className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform mx-1 shadow-md ${ticketIsActive ? "translate-x-[24px]" : "translate-x-0"}`}
                              />
                            </div>
                            <input
                              type="checkbox"
                              checked={ticketIsActive}
                              onChange={(e) =>
                                setTicketIsActive(e.target.checked)
                              }
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-baseline justify-between px-1">
                          <label className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                            号码策略配置 (红球 | 蓝球)
                          </label>
                          <div className="flex items-center gap-4">
                            {!editingTicket && (
                              <button
                                onClick={() => setIsBatchMode(!isBatchMode)}
                                className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer"
                              >
                                {isBatchMode ? "切换到单注录入" : "切换到批量粘贴"}
                              </button>
                            )}
                            <div className="text-[9px] font-mono text-slate-400">
                              双色球: 红01-33 蓝01-16 | 大乐透: 前01-35 后01-12
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 flex flex-col gap-4 shadow-inner">
                          {isBatchMode && !editingTicket ? (
                            <textarea
                              value={ticketBatchText}
                              onChange={(e) => setTicketBatchText(e.target.value)}
                              placeholder={`请在此粘贴多注号码，每注一行，格式如：\n03 13 20 29 34 | 01 12\n06 15 22 26 33 | 05 08`}
                              className="w-full h-32 p-3 rounded-xl border border-slate-200 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                            />
                          ) : (
                            <LotteryNumbersInput
                              lotteryType={ticketLotteryType}
                              redNumbers={ticketRedNumbers}
                              blueNumbers={ticketBlueNumbers}
                              onChange={(red, blue) => {
                                setTicketRedNumbers(red);
                                setTicketBlueNumbers(blue);
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleSaveTicket}
                      disabled={
                        createTicketMutation.isPending ||
                        updateTicketMutation.isPending
                      }
                      className="flex-1 h-12.5 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                    >
                      {createTicketMutation.isPending ||
                      updateTicketMutation.isPending
                        ? "正在保存..."
                        : "保存监控策略"}
                    </button>
                    <button
                      onClick={() => {
                        setShowTicketForm(false);
                        setEditingTicket(null);
                      }}
                      className="flex-1 h-12.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-[0.98]"
                    >
                      取消操作
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 列表显示 */}
            <div className="space-y-8">
              {ticketLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                  正在加载数据...
                </div>
              ) : (
                <>
                  {/* 双色球 */}
                  {groupedTickets.ssq.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-rose-500/10 to-transparent" />
                        <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-100/50">
                          双色球监控节点
                        </div>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-rose-500/10 to-transparent" />
                      </div>

                      <div className="rounded-[1.5rem] bg-white border border-slate-200 overflow-hidden shadow-sm backdrop-blur-xl">
                        <Table>
                          <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                策略名称
                              </TableHead>
                              <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                号码组合
                              </TableHead>
                              <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                状态
                              </TableHead>
                              <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                创建时间
                              </TableHead>
                              <TableHead className="py-4 px-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                操作
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedTickets.ssq.map((ticket: any) => (
                              <TableRow
                                key={ticket.id}
                                className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
                              >
                                <TableCell className="py-4.5 px-6">
                                  <span className="font-bold text-slate-900 tracking-tight">
                                    {ticket.name}
                                  </span>
                                </TableCell>
                                <TableCell className="py-4.5 px-4">
                                  <div className="flex items-center gap-1.5">
                                    {ticket.numbers.red.map(
                                      (num: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="w-7.5 h-7.5 rounded-lg bg-rose-50 border border-rose-100/80 flex items-center justify-center text-[10px] font-black text-rose-600 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 shadow-[0_2px_8px_rgba(244,63,94,0.04)]"
                                        >
                                          {num}
                                        </div>
                                      ),
                                    )}
                                    <div className="w-[1px] h-5 bg-slate-200 mx-1.5" />
                                    {ticket.numbers.blue.map(
                                      (num: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="w-7.5 h-7.5 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-[10px] font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-[0_2px_8px_rgba(99,102,241,0.04)]"
                                        >
                                          {num}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-4.5 px-4">
                                  <div
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                                      ticket.isActive
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-slate-100 text-slate-400 border-slate-200"
                                    }`}
                                  >
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${ticket.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
                                    />
                                    {ticket.isActive ? "已启用" : "已禁用"}
                                  </div>
                                </TableCell>
                                <TableCell className="py-4.5 px-4 font-mono text-[10px] text-slate-400 tracking-tight">
                                  {formatDate(ticket.createdAt)}
                                </TableCell>
                                <TableCell className="py-4.5 px-6 text-right">
                                  {(isAdmin || ticket.userId === user?.id) && (
                                    <div className="flex justify-end gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => !isGuest && handleEditTicket(ticket)}
                                        disabled={isGuest}
                                        className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${isGuest ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200"}`}
                                        title={isGuest ? "访客账号无权编辑" : "编辑策略"}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => !isGuest && handleToggleTicketActive(ticket)}
                                        disabled={isGuest}
                                        className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${isGuest ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30" : ticket.isActive ? "bg-slate-50 border-slate-200 text-amber-600 hover:bg-amber-50 hover:border-amber-200" : "bg-slate-50 border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"}`}
                                        title={isGuest ? "访客账号无权启用/停用" : ticket.isActive ? "停用策略" : "启用策略"}
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => !isGuest && handleDeleteTicket(ticket.id)}
                                        disabled={isGuest}
                                        className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${isGuest ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30" : "bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"}`}
                                        title={isGuest ? "访客账号无权删除" : "删除策略"}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* 大乐透 */}
                  {groupedTickets.dlt.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />
                        <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100/50">
                          大乐透监控节点
                        </div>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />
                      </div>

                      <div className="rounded-[1.5rem] bg-white border border-slate-200 overflow-hidden shadow-sm backdrop-blur-xl">
                        <Table>
                          <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                策略名称
                              </TableHead>
                              <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                号码组合
                              </TableHead>
                              <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                状态
                              </TableHead>
                              <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                创建时间
                              </TableHead>
                              <TableHead className="py-4 px-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                操作
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedTickets.dlt.map((ticket: any) => (
                              <TableRow
                                key={ticket.id}
                                className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
                              >
                                <TableCell className="py-4.5 px-6">
                                  <span className="font-bold text-slate-900 tracking-tight">
                                    {ticket.name}
                                  </span>
                                </TableCell>
                                <TableCell className="py-4.5 px-4">
                                  <div className="flex items-center gap-1.5">
                                    {ticket.numbers.red.map(
                                      (num: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="w-7.5 h-7.5 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-[10px] font-black text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 shadow-[0_2px_8px_rgba(245,158,11,0.04)]"
                                        >
                                          {num}
                                        </div>
                                      ),
                                    )}
                                    <div className="w-[1px] h-5 bg-slate-200 mx-1.5" />
                                    {ticket.numbers.blue.map(
                                      (num: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="w-7.5 h-7.5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[10px] font-black text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-[0_2px_8px_rgba(16,185,129,0.04)]"
                                        >
                                          {num}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-4.5 px-4">
                                  <div
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                                      ticket.isActive
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-slate-100 text-slate-400 border-slate-200"
                                    }`}
                                  >
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${ticket.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
                                    />
                                    {ticket.isActive ? "已启用" : "已禁用"}
                                  </div>
                                </TableCell>
                                <TableCell className="py-4.5 px-4 font-mono text-[10px] text-slate-400 tracking-tight">
                                  {formatDate(ticket.createdAt)}
                                </TableCell>
                                <TableCell className="py-4.5 px-6 text-right">
                                  {(isAdmin || ticket.userId === user?.id) && (
                                    <div className="flex justify-end gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => !isGuest && handleEditTicket(ticket)}
                                        disabled={isGuest}
                                        className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${isGuest ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200"}`}
                                        title={isGuest ? "访客账号无权编辑" : "编辑策略"}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => !isGuest && handleToggleTicketActive(ticket)}
                                        disabled={isGuest}
                                        className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${isGuest ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30" : ticket.isActive ? "bg-slate-50 border-slate-200 text-amber-600 hover:bg-amber-50 hover:border-amber-200" : "bg-slate-50 border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"}`}
                                        title={isGuest ? "访客账号无权启用/停用" : ticket.isActive ? "停用策略" : "启用策略"}
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => !isGuest && handleDeleteTicket(ticket.id)}
                                        disabled={isGuest}
                                        className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${isGuest ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30" : "bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"}`}
                                        title={isGuest ? "访客账号无权删除" : "删除策略"}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* 空状态 */}
                  {groupedTickets.ssq.length === 0 &&
                    groupedTickets.dlt.length === 0 && (
                      <div className="py-24 text-center bg-white border border-slate-200 border-dashed rounded-[1.5rem]">
                        <Activity className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">
                          暂无监控策略
                        </p>
                        <p className="text-slate-400 text-xs text-center px-4">
                          当前尚未配置号码监控节点。点击上方按钮开始守号。
                        </p>
                      </div>
                    )}

                  {ticketTotalPages > 1 && (
                    <div className="flex justify-center pt-8">
                      <Pagination>
                        <PaginationContent className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                          <PaginationItem>
                            <PaginationPrevious
                              className="rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                              onClick={() => {
                                if (ticketPage > 1)
                                  setTicketPage(ticketPage - 1);
                              }}
                              style={{
                                cursor:
                                  ticketPage > 1 ? "pointer" : "not-allowed",
                              }}
                            />
                          </PaginationItem>
                          {Array.from(
                            { length: ticketTotalPages },
                            (_, i) => i + 1,
                          )
                            .filter(
                              (page) =>
                                page === 1 ||
                                page === ticketTotalPages ||
                                (page >= ticketPage - 1 &&
                                  page <= ticketPage + 1),
                            )
                            .map((page, idx, arr) => (
                              <div key={page} className="flex items-center">
                                {idx > 0 && arr[idx - 1] !== page - 1 && (
                                  <span className="text-slate-400 px-1 font-bold pb-1 text-xs">
                                    ...
                                  </span>
                                )}
                                <PaginationItem>
                                  <PaginationLink
                                    className={`w-8 h-8 rounded-lg transition-all font-black text-xs ${ticketPage === page ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                                    onClick={() => setTicketPage(page)}
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
                                if (ticketPage < ticketTotalPages)
                                  setTicketPage(ticketPage + 1);
                              }}
                              style={{
                                cursor:
                                  ticketPage < ticketTotalPages
                                    ? "pointer"
                                    : "not-allowed",
                              }}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 邮箱管理 */}
        {activeTab === "emails" && (
          <div className="animate-in fade-in zoom-in-98 duration-500 space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 rounded-[2rem] bg-white border border-slate-200/80 shadow-sm backdrop-blur-xl gap-6">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Mail className="w-5.5 h-5.5" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                    通知订阅列表
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    接收推送通知的投递节点
                  </p>
                </div>
              </div>

              {!isGuest ? (
                <button
                  onClick={handleAddEmail}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white transition-all shadow-md shadow-emerald-100 flex items-center gap-2 text-xs font-black w-full lg:w-auto justify-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增通知地址</span>
                </button>
              ) : (
                <div className="px-5 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold flex items-center gap-2 ml-auto cursor-not-allowed opacity-60">
                  <Plus className="w-4 h-4" />
                  <span>🔒 访客模式(只读)</span>
                </div>
              )}
            </div>

            {showEmailForm && (
              <div className="p-6 md:p-10 rounded-[2rem] bg-white border border-slate-200 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-500 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/[0.02] blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none" />

                <div className="relative z-10 space-y-8">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div className="space-y-0.5">
                      <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">
                        {editingEmail ? "编辑通知信息" : "添加通知地址"}
                      </h3>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        EMAIL NOTIFICATION CONFIG
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        运行正常
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                        收件邮箱
                      </label>
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="您的通知邮箱@example.com"
                        className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-300 font-bold tracking-tight text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                        备注名称
                      </label>
                      <input
                        type="text"
                        value={emailName}
                        onChange={(e) => setEmailName(e.target.value)}
                        placeholder="例：主节点_01"
                        className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-300 font-bold tracking-tight text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        启用通知订阅
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium tracking-tight uppercase">
                        开启后该地址将实时接收中奖匹配推送
                      </div>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <div
                        className={`w-12 h-6 flex items-center rounded-full transition-all duration-300 ${emailIsActive ? "bg-emerald-600 shadow-sm" : "bg-slate-300"}`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform mx-1 shadow-md ${emailIsActive ? "translate-x-[24px]" : "translate-x-0"}`}
                        />
                      </div>
                      <input
                        type="checkbox"
                        checked={emailIsActive}
                        onChange={(e) => setEmailIsActive(e.target.checked)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleSaveEmail}
                      disabled={
                        createEmailMutation.isPending ||
                        updateEmailMutation.isPending
                      }
                      className="flex-1 h-12.5 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                    >
                      {createEmailMutation.isPending ||
                      updateEmailMutation.isPending
                        ? "正在保存..."
                        : "保存邮箱配置"}
                    </button>
                    <button
                      onClick={() => {
                        setShowEmailForm(false);
                        setEditingEmail(null);
                      }}
                      className="flex-1 h-12.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-[0.98]"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 邮箱列表 */}
            {emailLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                正在扫描终端资产...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.5rem] bg-white border border-slate-200 overflow-hidden shadow-sm backdrop-blur-xl">
                  <Table>
                    <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          通知邮箱
                        </TableHead>
                        <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          备注名称
                        </TableHead>
                        <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          状态
                        </TableHead>
                        <TableHead className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          添加时间
                        </TableHead>
                        <TableHead className="py-4 px-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          操作
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailData?.data?.list.map((email: any) => (
                        <TableRow
                          key={email.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
                        >
                          <TableCell className="py-4.5 px-6">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {email.email}
                            </span>
                          </TableCell>
                          <TableCell className="py-4.5 px-4 font-bold text-slate-500">
                            {email.name || "无备注节点"}
                          </TableCell>
                          <TableCell className="py-4.5 px-4">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                                email.isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-400 border-slate-200"
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${email.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
                              />
                              {email.isActive ? "已启用" : "已停用"}
                            </div>
                          </TableCell>
                          <TableCell className="py-4.5 px-4 font-mono text-[10px] text-slate-400 tracking-tight">
                            {formatDate(email.createdAt)}
                          </TableCell>
                          <TableCell className="py-4.5 px-6 text-right">
                            <div className="flex justify-end gap-1.5 transition-all">
                              <button
                                onClick={() => !isGuest && handleEditEmail(email)}
                                disabled={isGuest}
                                className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${
                                  isGuest
                                    ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30"
                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                                }`}
                                title={isGuest ? "🔒 访客只读" : "编辑"}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => !isGuest && handleToggleEmailActive(email)}
                                disabled={isGuest}
                                className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${
                                  isGuest
                                    ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30"
                                    : email.isActive
                                      ? "bg-slate-50 border-slate-200 text-amber-600 hover:bg-amber-50 hover:border-amber-200"
                                      : "bg-slate-50 border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                                }`}
                                title={isGuest ? "🔒 访客只读" : "切换状态"}
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => !isGuest && handleDeleteEmail(email.id)}
                                disabled={isGuest}
                                className={`p-2 rounded-lg border transition-all active:scale-[0.92] ${
                                  isGuest
                                    ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-30"
                                    : "bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                                }`}
                                title={isGuest ? "🔒 访客只读" : "删除"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!emailData?.data?.list ||
                        emailData.data.list.length === 0) && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="py-24 text-center">
                            <Moon className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">
                              暂无投递目标
                            </p>
                            <p className="text-slate-400 text-xs text-center max-w-xs mx-auto px-4">
                              尚未配置通知接收地址。请添加邮箱以接收实时中奖预警。
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {emailTotalPages > 1 && (
                  <div className="flex justify-center pt-8">
                    <Pagination>
                      <PaginationContent className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <PaginationItem>
                          <PaginationPrevious
                            className="rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                            onClick={() => {
                              if (emailPage > 1) setEmailPage(emailPage - 1);
                            }}
                            style={{
                              cursor: emailPage > 1 ? "pointer" : "not-allowed",
                            }}
                          />
                        </PaginationItem>
                        {Array.from(
                          { length: emailTotalPages },
                          (_, i) => i + 1,
                        )
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === emailTotalPages ||
                              (page >= emailPage - 1 && page <= emailPage + 1),
                          )
                          .map((page, idx, arr) => (
                            <div key={page} className="flex items-center">
                              {idx > 0 && arr[idx - 1] !== page - 1 && (
                                <span className="text-slate-400 px-1 font-bold pb-1 text-xs">
                                  ...
                                </span>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  className={`w-8 h-8 rounded-lg transition-all font-black text-xs ${emailPage === page ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                                  onClick={() => setEmailPage(page)}
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
                              if (emailPage < emailTotalPages)
                                setEmailPage(emailPage + 1);
                            }}
                            style={{
                              cursor:
                                emailPage < emailTotalPages
                                  ? "pointer"
                                  : "not-allowed",
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
