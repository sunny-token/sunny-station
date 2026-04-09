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
  Edit3
} from "lucide-react";
import { formatDate } from "../../lib/utils";
import { useRouter } from "next/navigation";
import { trpc } from "../../server/client";

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

  // 邮箱相关状态
  const [emailPage, setEmailPage] = useState(1);
  const [emailTotalPages, setEmailTotalPages] = useState(1);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [editingEmail, setEditingEmail] = useState<any>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailIsActive, setEmailIsActive] = useState(true);

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
    setShowTicketForm(true);
  };

  const handleEditTicket = (ticket: any) => {
    setEditingTicket(ticket);
    setTicketName(ticket.name);
    setTicketLotteryType(ticket.lotteryType);
    setTicketRedNumbers([...ticket.numbers.red]);
    setTicketBlueNumbers([...ticket.numbers.blue]);
    setTicketIsActive(ticket.isActive);
    setShowTicketForm(true);
  };

  const handleSaveTicket = async () => {
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

    if (!ticketName.trim()) {
      setResult("请输入预设号码名称");
      return;
    }

    try {
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
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-indigo-500/30 font-sans">
      {/* 氛围背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.08),transparent_70%)]" />
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto p-6 md:p-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
        {/* Navigation & Header */}
        <header className="mb-16 space-y-10">
          <button
            onClick={() => router.push("/")}
            className="group flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 font-medium"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm tracking-tight">返回控制中心</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase tracking-[0.2em] font-black">
                <Settings2 className="w-3 h-3" />
                底层系统架构
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white">
                核心运行 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500">配置参数</span>
              </h1>
              <p className="text-slate-500 text-lg font-light max-w-xl leading-relaxed">
                管理全局干预逻辑、模型信标及其监听节点。此处的所有改动将实时同步至核心执行引擎。
              </p>
            </div>
          </div>
        </header>

        {/* Global Feedback */}
        {result && (
          <div className={`p-5 rounded-3xl mb-12 flex items-start gap-4 border backdrop-blur-3xl shadow-2xl animate-in zoom-in-95 duration-500 ${
            result.includes("成功") || result.includes("完成")
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/5 border-red-500/20 text-red-400"
          }`}>
            {result.includes("成功") || result.includes("完成") ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-bold tracking-tight whitespace-pre-line leading-relaxed">{result}</p>
            </div>
          </div>
        )}

        {/* Tab System */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl">
          <button
            onClick={() => setActiveTab("tickets")}
            className={`group relative flex items-center justify-center gap-3 px-8 py-5 rounded-[1.75rem] transition-all duration-500 overflow-hidden ${
              activeTab === "tickets"
                ? "bg-white text-black shadow-2xl"
                : "text-slate-500 hover:text-white hover:bg-white/5"
            }`}
          >
            {activeTab === "tickets" && (
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent opacity-50" />
            )}
            <Zap className={`w-5 h-5 transition-transform duration-500 ${activeTab === "tickets" ? "scale-110" : "group-hover:scale-110"}`} />
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-widest leading-none">干预模型</div>
              <div className="text-[10px] font-medium opacity-50 uppercase tracking-tighter mt-1">干预策略模型</div>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab("emails")}
            className={`group relative flex items-center justify-center gap-3 px-8 py-5 rounded-[1.75rem] transition-all duration-500 overflow-hidden ${
              activeTab === "emails"
                ? "bg-white text-black shadow-2xl"
                : "text-slate-500 hover:text-white hover:bg-white/5"
            }`}
          >
            {activeTab === "emails" && (
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent opacity-50" />
            )}
            <Mail className={`w-5 h-5 transition-transform duration-500 ${activeTab === "emails" ? "scale-110" : "group-hover:scale-110"}`} />
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-widest leading-none">投递终端</div>
              <div className="text-[10px] font-medium opacity-50 uppercase tracking-tighter mt-1">通知推送节点</div>
            </div>
          </button>
        </div>

        {/* 预设号码管理 */}
        {activeTab === "tickets" && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black tracking-tight text-white uppercase">活跃执行池</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">活跃执行池登记中心</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/批量导入模板.xlsx"
                  download
                  className="group px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-wider">下载导入规范</span>
                </a>
                
                <div className="flex items-center bg-black/20 p-1.5 rounded-xl border border-white/[0.05]">
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="import-file-input"
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-all cursor-pointer flex items-center gap-2 border border-white/5"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    选择规范文件
                  </label>
                  {importFile && (
                    <div className="flex items-center gap-2 ml-2 animate-in slide-in-from-left-2">
                      <span className="text-[10px] font-mono text-indigo-400 max-w-[120px] truncate">
                        {importFile.name}
                      </span>
                      <button
                        onClick={handleBatchImport}
                        disabled={isImporting}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                      >
                        {isImporting ? "正在同步" : "执行导入"}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAddTicket}
                  className="px-6 py-3 rounded-2xl bg-white text-black hover:bg-slate-200 transition-all shadow-xl flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-black uppercase tracking-wider">增加策略节点</span>
                </button>
              </div>
            </div>

            {showTicketForm && (
              <div className="p-8 lg:p-12 rounded-[3.5rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-6 duration-700 relative group overflow-hidden">
                 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
                 
                 <div className="relative z-10 space-y-12">
                  <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                        {editingTicket ? "重构策略模型" : "新建策略节点"}
                      </h3>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">策略配置子系统</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">系统链路激活</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block px-1">数据路由 - 数据中心</label>
                        <select
                          value={ticketLotteryType}
                          onChange={(e) => {
                            const newType = e.target.value as "ssq" | "dlt";
                            setTicketLotteryType(newType);
                            setTicketRedNumbers(newType === "ssq" ? ["", "", "", "", "", ""] : ["", "", "", "", ""]);
                            setTicketBlueNumbers(newType === "ssq" ? [""] : ["", ""]);
                          }}
                          className="w-full h-14 px-6 rounded-2xl bg-black/40 border border-white/10 text-white outline-none focus:border-indigo-500 hover:bg-black/60 transition-all appearance-none cursor-pointer font-bold tracking-tight"
                        >
                          <option value="ssq" className="bg-slate-900 px-4 py-2">双色球 - 代理链路激活</option>
                          <option value="dlt" className="bg-slate-900 px-4 py-2">大乐透 - 代理链路激活</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block px-1">信标标识 - 节点 ID</label>
                        <input
                          type="text"
                          value={ticketName}
                          onChange={(e) => setTicketName(e.target.value)}
                          placeholder="例：策略模型_A"
                          className="w-full h-14 px-6 rounded-2xl bg-black/40 border border-white/10 text-white outline-none focus:border-indigo-500 hover:bg-black/60 transition-all placeholder:text-slate-800 font-bold tracking-tight"
                        />
                      </div>

                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="text-xs font-black text-white uppercase tracking-wider">周期性监听协议</div>
                            <div className="text-[9px] text-slate-500 font-medium tracking-tight uppercase">持续自动同步协议</div>
                          </div>
                          <label className="flex items-center cursor-pointer">
                            <div className={`w-14 h-7 flex items-center rounded-full transition-all duration-500 ${ticketIsActive ? 'bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-slate-800'}`}>
                              <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-500 transform mx-1 shadow-2xl ${ticketIsActive ? 'translate-x-[28px]' : 'translate-x-0'}`} />
                            </div>
                            <input type="checkbox" checked={ticketIsActive} onChange={(e) => setTicketIsActive(e.target.checked)} className="hidden" />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-10">
                      <div className="space-y-4">
                        <div className="flex items-baseline justify-between px-1">
                          <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">红球矩阵 - 原始数据</label>
                          <div className="text-[9px] font-mono text-slate-600">输入范围: {ticketLotteryType === "ssq" ? "01-33" : "01-35"}</div>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {ticketRedNumbers.map((num, idx) => (
                            <input
                              key={idx}
                              type="number"
                              min="1"
                              max={ticketLotteryType === "ssq" ? "33" : "35"}
                              value={num}
                              onChange={(e) => {
                                const newNums = [...ticketRedNumbers];
                                newNums[idx] = e.target.value;
                                setTicketRedNumbers(newNums);
                              }}
                              placeholder="--"
                              className="w-full h-14 text-center rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500 font-black text-xl outline-none focus:bg-red-500/15 focus:border-red-500/40 transition-all placeholder:opacity-20"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-baseline justify-between px-1">
                          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">蓝球矩阵 - 原始数据</label>
                          <div className="text-[9px] font-mono text-slate-600">输入范围: {ticketLotteryType === "ssq" ? "01-16" : "01-12"}</div>
                        </div>
                        <div className="flex gap-2">
                          {ticketBlueNumbers.map((num, idx) => (
                            <input
                              key={idx}
                              type="number"
                              min="1"
                              max={ticketLotteryType === "ssq" ? "16" : "12"}
                              value={num}
                              onChange={(e) => {
                                const newNums = [...ticketBlueNumbers];
                                newNums[idx] = e.target.value;
                                setTicketBlueNumbers(newNums);
                              }}
                              placeholder="--"
                              className="w-14 h-14 text-center rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 font-black text-xl outline-none focus:bg-indigo-500/15 focus:border-indigo-500/40 transition-all placeholder:opacity-20"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t border-white/5">
                    <button
                      onClick={handleSaveTicket}
                      disabled={createTicketMutation.isPending || updateTicketMutation.isPending}
                      className="flex-1 h-16 rounded-[1.25rem] bg-white text-black font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-200 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                    >
                      {createTicketMutation.isPending || updateTicketMutation.isPending ? "正在下发指令..." : "同步至核心引擎"}
                    </button>
                    <button
                      onClick={() => { setShowTicketForm(false); setEditingTicket(null); }}
                      className="flex-1 h-16 rounded-[1.25rem] bg-white/5 border border-white/10 text-slate-400 hover:text-white font-black text-sm uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-[0.98]"
                    >
                      中止当前操作
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 列表显示 */}
            <div className="space-y-12">
              {ticketLoading ? (
                <div className="flex items-center justify-center py-24 text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">正在初始化数据流...</div>
              ) : (
                <>
                  {/* 双色球 */}
                  {groupedTickets.ssq.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
                        <div className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.4em]">双色球策略集群</div>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
                      </div>
                      
                      <div className="rounded-[2.5rem] bg-white/[0.01] border border-white/[0.06] overflow-hidden backdrop-blur-3xl shadow-2xl">
                        <Table>
                          <TableHeader className="bg-white/[0.02]">
                            <TableRow className="border-white/[0.05] hover:bg-transparent">
                              <TableHead className="py-6 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">信标模型</TableHead>
                              <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">干预矩阵 (RED/BLUE)</TableHead>
                              <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">监听状态</TableHead>
                              <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">建立时间</TableHead>
                              <TableHead className="py-6 px-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">操作终端</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedTickets.ssq.map((ticket: any) => (
                              <TableRow key={ticket.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                                <TableCell className="py-6 px-8">
                                  <span className="font-bold text-white tracking-tight">{ticket.name}</span>
                                </TableCell>
                                <TableCell className="py-6 px-4">
                                  <div className="flex items-center gap-2">
                                    {ticket.numbers.red.map((num: string, idx: number) => (
                                      <div key={idx} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/10 flex items-center justify-center text-[10px] font-black text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                                        {num}
                                      </div>
                                    ))}
                                    <div className="w-[1px] h-6 bg-white/10 mx-1" />
                                    {ticket.numbers.blue.map((num: string, idx: number) => (
                                      <div key={idx} className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center text-[10px] font-black text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                                        {num}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6 px-4">
                                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                                    ticket.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-600 border-white/5"
                                  }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${ticket.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                                    {ticket.isActive ? "激活" : "待命"}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6 px-4 font-mono text-[10px] text-slate-500 tracking-tighter">
                                  {formatDate(ticket.createdAt)}
                                </TableCell>
                                <TableCell className="py-6 px-8 text-right">
                                  <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditTicket(ticket)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 transition-all active:scale-[0.9]"><Edit3 className="w-4 h-4" /></button>
                                    <button onClick={() => handleToggleTicketActive(ticket)} className={`p-2.5 rounded-xl bg-white/5 border border-white/10 transition-all active:scale-[0.9] ${ticket.isActive ? "text-amber-400 hover:bg-amber-600 hover:text-white hover:border-amber-600" : "text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"}`}><Zap className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteTicket(ticket.id)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all active:scale-[0.9]"><Trash2 className="w-4 h-4" /></button>
                                  </div>
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
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                        <div className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.4em]">大乐透策略集群</div>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                      </div>
                      
                      <div className="rounded-[2.5rem] bg-white/[0.01] border border-white/[0.06] overflow-hidden backdrop-blur-3xl shadow-2xl">
                        <Table>
                          <TableHeader className="bg-white/[0.02]">
                            <TableRow className="border-white/[0.05] hover:bg-transparent">
                              <TableHead className="py-6 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">信标模型</TableHead>
                              <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">干预矩阵 (RED/BLUE)</TableHead>
                              <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">监听状态</TableHead>
                              <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">建立时间</TableHead>
                              <TableHead className="py-6 px-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">操作终端</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedTickets.dlt.map((ticket: any) => (
                              <TableRow key={ticket.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                                <TableCell className="py-6 px-8">
                                  <span className="font-bold text-white tracking-tight">{ticket.name}</span>
                                </TableCell>
                                <TableCell className="py-6 px-4">
                                  <div className="flex items-center gap-2">
                                    {ticket.numbers.red.map((num: string, idx: number) => (
                                      <div key={idx} className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/10 flex items-center justify-center text-[10px] font-black text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                                        {num}
                                      </div>
                                    ))}
                                    <div className="w-[1px] h-6 bg-white/10 mx-1" />
                                    {ticket.numbers.blue.map((num: string, idx: number) => (
                                      <div key={idx} className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center text-[10px] font-black text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                        {num}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6 px-4">
                                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                                    ticket.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-600 border-white/5"
                                  }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${ticket.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                                    {ticket.isActive ? "ACTIVE" : "STANDBY"}
                                  </div>
                                </TableCell>
                                <TableCell className="py-6 px-4 font-mono text-[10px] text-slate-500 tracking-tighter">
                                  {formatDate(ticket.createdAt)}
                                </TableCell>
                                <TableCell className="py-6 px-8 text-right">
                                  <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditTicket(ticket)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 transition-all active:scale-[0.9]"><Edit3 className="w-4 h-4" /></button>
                                    <button onClick={() => handleToggleTicketActive(ticket)} className={`p-2.5 rounded-xl bg-white/5 border border-white/10 transition-all active:scale-[0.9] ${ticket.isActive ? "text-amber-400 hover:bg-amber-600 hover:text-white hover:border-amber-600" : "text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"}`}><Zap className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteTicket(ticket.id)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all active:scale-[0.9]"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* 空状态 */}
                  {groupedTickets.ssq.length === 0 && groupedTickets.dlt.length === 0 && (
                      <div className="py-32 text-center bg-white/[0.01] border border-white/[0.05] border-dashed rounded-[3rem]">
                        <Activity className="w-12 h-12 text-slate-800 mx-auto mb-6" />
                        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm mb-2">零节点检测</p>
                        <p className="text-slate-600 text-xs text-center">当前集群内未发现活跃的干预模型，请先建立首个监控节点。</p>
                      </div>
                    )}
                  
                  {ticketTotalPages > 1 && (
                    <div className="flex justify-center pt-12">
                      <Pagination>
                        <PaginationContent className="bg-white/5 p-1 rounded-2xl border border-white/5">
                          <PaginationItem>
                            <PaginationPrevious
                              className="rounded-xl hover:bg-white/10 text-white disabled:opacity-30"
                              onClick={() => { if (ticketPage > 1) setTicketPage(ticketPage - 1); }}
                              style={{ cursor: ticketPage > 1 ? "pointer" : "not-allowed" }}
                            />
                          </PaginationItem>
                          {Array.from({ length: ticketTotalPages }, (_, i) => i + 1)
                            .filter((page) => page === 1 || page === ticketTotalPages || (page >= ticketPage - 1 && page <= ticketPage + 1))
                            .map((page, idx, arr) => (
                              <div key={page} className="flex items-center">
                                {idx > 0 && arr[idx-1] !== page - 1 && <span className="text-slate-700 px-2 font-black pb-1">...</span>}
                                <PaginationItem>
                                  <PaginationLink
                                    className={`w-10 h-10 rounded-xl transition-all font-black text-xs ${ticketPage === page ? "bg-white text-black hover:bg-white shadow-xl" : "text-slate-500 hover:bg-white/10 hover:text-white"}`}
                                    onClick={() => setTicketPage(page)}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              </div>
                            ))}
                          <PaginationItem>
                            <PaginationNext
                              className="rounded-xl hover:bg-white/10 text-white disabled:opacity-30"
                              onClick={() => { if (ticketPage < ticketTotalPages) setTicketPage(ticketPage + 1); }}
                              style={{ cursor: ticketPage < ticketTotalPages ? "pointer" : "not-allowed" }}
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
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black tracking-tight text-white uppercase">投递终端 登记中心</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">通知推送终端资产池</p>
                </div>
              </div>

              <button
                onClick={handleAddEmail}
                className="px-6 py-3 rounded-2xl bg-white text-black hover:bg-slate-200 transition-all shadow-xl flex items-center gap-2 ml-auto"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-black uppercase tracking-wider">挂载投递节点</span>
              </button>
            </div>

            {showEmailForm && (
              <div className="p-8 lg:p-12 rounded-[3.5rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-6 duration-700 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
                
                <div className="relative z-10 space-y-12">
                   <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                        {editingEmail ? "维护投递终端" : "建立投递链路"}
                      </h3>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">邮件调度配置系统</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">节点在线</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block px-1">终端地址 - 节点通讯录</label>
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="管理员邮箱@example.com"
                        className="w-full h-14 px-6 rounded-2xl bg-black/40 border border-white/10 text-white outline-none focus:border-emerald-500 hover:bg-black/60 transition-all placeholder:text-slate-800 font-bold tracking-tight"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block px-1">终端信标 - 资产标签</label>
                      <input
                        type="text"
                        value={emailName}
                        onChange={(e) => setEmailName(e.target.value)}
                        placeholder="例：主节点_01"
                        className="w-full h-14 px-6 rounded-2xl bg-black/40 border border-white/10 text-white outline-none focus:border-emerald-500 hover:bg-black/60 transition-all placeholder:text-slate-800 font-bold tracking-tight"
                      />
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-black text-white uppercase tracking-wider">使能实时投递</div>
                      <div className="text-[9px] text-slate-500 font-medium tracking-tight uppercase">实时负载传输协议</div>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <div className={`w-14 h-7 flex items-center rounded-full transition-all duration-500 ${emailIsActive ? 'bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-500 transform mx-1 shadow-2xl ${emailIsActive ? 'translate-x-[28px]' : 'translate-x-0'}`} />
                      </div>
                      <input type="checkbox" checked={emailIsActive} onChange={(e) => setEmailIsActive(e.target.checked)} className="hidden" />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t border-white/5">
                    <button
                      onClick={handleSaveEmail}
                      disabled={createEmailMutation.isPending || updateEmailMutation.isPending}
                      className="flex-1 h-16 rounded-[1.25rem] bg-indigo-600 text-white font-black text-sm uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {createEmailMutation.isPending || updateEmailMutation.isPending ? "正在建立连接..." : "确认下达链路指令"}
                    </button>
                    <button
                      onClick={() => { setShowEmailForm(false); setEditingEmail(null); }}
                      className="flex-1 h-16 rounded-[1.25rem] bg-white/5 border border-white/10 text-slate-400 hover:text-white font-black text-sm uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-[0.98]"
                    >
                      中止当前操作
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 邮箱列表 */}
            {emailLoading ? (
              <div className="flex items-center justify-center py-24 text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">正在扫描终端资产...</div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[2.5rem] bg-white/[0.01] border border-white/[0.06] overflow-hidden backdrop-blur-3xl shadow-2xl">
                  <Table>
                    <TableHeader className="bg-white/[0.02]">
                      <TableRow className="border-white/[0.05] hover:bg-transparent">
                        <TableHead className="py-6 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">终端链路地址</TableHead>
                        <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">资产信标名称</TableHead>
                        <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">寻呼应答状态</TableHead>
                        <TableHead className="py-6 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">挂载时间</TableHead>
                        <TableHead className="py-6 px-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">管理控制</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailData?.data?.list.map((email: any) => (
                        <TableRow key={email.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                          <TableCell className="py-6 px-8">
                            <span className="font-mono text-xs font-bold text-white/90">{email.email}</span>
                          </TableCell>
                          <TableCell className="py-6 px-4 font-bold text-slate-400">{email.name || "未命名资产"}</TableCell>
                          <TableCell className="py-6 px-4">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                              email.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-600 border-white/5"
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${email.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                              {email.isActive ? "接收中" : "已挂起"}
                            </div>
                          </TableCell>
                          <TableCell className="py-6 px-4 font-mono text-[10px] text-slate-500 tracking-tighter">{formatDate(email.createdAt)}</TableCell>
                          <TableCell className="py-6 px-8 text-right">
                            <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditEmail(email)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 transition-all active:scale-[0.9]"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => handleToggleEmailActive(email)} className={`p-2.5 rounded-xl bg-white/5 border border-white/10 transition-all active:scale-[0.9] ${email.isActive ? "text-amber-400 hover:bg-amber-600 hover:text-white hover:border-amber-600" : "text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"}`}><Zap className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteEmail(email.id)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all active:scale-[0.9]"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!emailData?.data?.list || emailData.data.list.length === 0) && (
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableCell colSpan={5} className="py-32 text-center">
                            <Moon className="w-12 h-12 text-slate-800 mx-auto mb-6" />
                            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm mb-2">链路中断</p>
                            <p className="text-slate-600 text-xs text-center max-w-xs mx-auto">当前没有任何挂载的投递终端，所有系统通知将被暂存于缓冲区直至链路建立。</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {emailTotalPages > 1 && (
                  <div className="flex justify-center pt-12">
                    <Pagination>
                      <PaginationContent className="bg-white/5 p-1 rounded-2xl border border-white/5">
                        <PaginationItem>
                          <PaginationPrevious
                            className="rounded-xl hover:bg-white/10 text-white disabled:opacity-30"
                            onClick={() => { if (emailPage > 1) setEmailPage(emailPage - 1); }}
                            style={{ cursor: emailPage > 1 ? "pointer" : "not-allowed" }}
                          />
                        </PaginationItem>
                        {Array.from({ length: emailTotalPages }, (_, i) => i + 1)
                          .filter((page) => page === 1 || page === emailTotalPages || (page >= emailPage - 1 && page <= emailPage + 1))
                          .map((page, idx, arr) => (
                            <div key={page} className="flex items-center">
                               {idx > 0 && arr[idx-1] !== page - 1 && <span className="text-slate-700 px-2 font-black pb-1">...</span>}
                              <PaginationItem>
                                <PaginationLink
                                  className={`w-10 h-10 rounded-xl transition-all font-black text-xs ${emailPage === page ? "bg-white text-black hover:bg-white shadow-xl" : "text-slate-500 hover:bg-white/10 hover:text-white"}`}
                                  onClick={() => setEmailPage(page)}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </div>
                          ))}
                        <PaginationItem>
                          <PaginationNext
                            className="rounded-xl hover:bg-white/10 text-white disabled:opacity-30"
                            onClick={() => { if (emailPage < emailTotalPages) setEmailPage(emailPage + 1); }}
                            style={{ cursor: emailPage < emailTotalPages ? "pointer" : "not-allowed" }}
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
