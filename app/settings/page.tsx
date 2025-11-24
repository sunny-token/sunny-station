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
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          style={{ marginBottom: 16 }}
        >
          ← 返回首页
        </Button>
        <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>
          系统设置
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          管理预设号码和邮件收件人
        </p>
      </div>

      {result && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 6,
            background: result.includes("成功") ? "#d1fae5" : "#fee2e2",
            color: result.includes("成功") ? "#065f46" : "#991b1b",
            fontSize: 14,
          }}
        >
          {result}
        </div>
      )}

      {/* 标签页切换 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={() => setActiveTab("tickets")}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 500,
            background: "transparent",
            border: "none",
            borderBottom:
              activeTab === "tickets"
                ? "2px solid #2563eb"
                : "2px solid transparent",
            color: activeTab === "tickets" ? "#2563eb" : "#6b7280",
            cursor: "pointer",
          }}
        >
          预设号码管理
        </button>
        <button
          onClick={() => setActiveTab("emails")}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 500,
            background: "transparent",
            border: "none",
            borderBottom:
              activeTab === "emails"
                ? "2px solid #2563eb"
                : "2px solid transparent",
            color: activeTab === "emails" ? "#2563eb" : "#6b7280",
            cursor: "pointer",
          }}
        >
          邮件收件人管理
        </button>
      </div>

      {/* 预设号码管理 */}
      {activeTab === "tickets" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <h2 style={{ fontSize: 20 }}>预设号码管理</h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <a
                href="/批量导入模板.xlsx"
                download
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                📥 下载模板
              </a>
              {/* 批量导入 */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  id="import-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="import-file-input"
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "inline-block",
                  }}
                >
                  📁 选择 Excel 文件
                </label>
                {importFile && (
                  <>
                    <span style={{ fontSize: 14, color: "#6b7280" }}>
                      {importFile.name}
                    </span>
                    <button
                      onClick={handleBatchImport}
                      disabled={isImporting}
                      style={{
                        padding: "8px 24px",
                        fontSize: 14,
                        background: isImporting ? "#9ca3af" : "#3b82f6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: isImporting ? "not-allowed" : "pointer",
                      }}
                    >
                      {isImporting ? "导入中..." : "开始导入"}
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={handleAddTicket}
                style={{
                  padding: "8px 24px",
                  fontSize: 16,
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                + 添加预设号码
              </button>
            </div>
          </div>

          {/* 添加/编辑表单 */}
          {showTicketForm && (
            <div
              style={{
                marginBottom: 24,
                padding: 20,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>
                {editingTicket ? "编辑预设号码" : "添加预设号码"}
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    彩票类型
                  </label>
                  <select
                    value={ticketLotteryType}
                    onChange={(e) => {
                      const newType = e.target.value as "ssq" | "dlt";
                      setTicketLotteryType(newType);
                      // 根据类型调整号码输入框
                      setTicketRedNumbers(
                        newType === "ssq"
                          ? ["", "", "", "", "", ""]
                          : ["", "", "", "", ""],
                      );
                      setTicketBlueNumbers(newType === "ssq" ? [""] : ["", ""]);
                    }}
                    style={{
                      width: "100%",
                      maxWidth: 400,
                      padding: "8px 12px",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      outline: "none",
                    }}
                  >
                    <option value="ssq">双色球</option>
                    <option value="dlt">大乐透</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    名称/备注
                  </label>
                  <input
                    type="text"
                    value={ticketName}
                    onChange={(e) => setTicketName(e.target.value)}
                    placeholder="例如：我的幸运号码"
                    style={{
                      width: "100%",
                      maxWidth: 400,
                      padding: "8px 12px",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    红球号码（
                    {ticketLotteryType === "ssq" ? "6个，01-33" : "5个，01-35"}
                    ）
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                        placeholder={`红${idx + 1}`}
                        style={{
                          width: 60,
                          padding: "8px 12px",
                          fontSize: 14,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          outline: "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    蓝球号码（
                    {ticketLotteryType === "ssq" ? "1个，01-16" : "2个，01-12"}
                    ）
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                        placeholder={`蓝${idx + 1}`}
                        style={{
                          width: 60,
                          padding: "8px 12px",
                          fontSize: 14,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          outline: "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ticketIsActive}
                      onChange={(e) => setTicketIsActive(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <span>激活（激活的预设号码会在开奖时自动匹配）</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleSaveTicket}
                    disabled={
                      createTicketMutation.isPending ||
                      updateTicketMutation.isPending
                    }
                    style={{
                      padding: "8px 24px",
                      fontSize: 14,
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {createTicketMutation.isPending ||
                    updateTicketMutation.isPending
                      ? "保存中..."
                      : "保存"}
                  </button>
                  <button
                    onClick={() => {
                      setShowTicketForm(false);
                      setEditingTicket(null);
                    }}
                    style={{
                      padding: "8px 24px",
                      fontSize: 14,
                      background: "#6b7280",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 预设号码列表 - 按类型分组显示 */}
          {ticketLoading ? (
            <div>加载中...</div>
          ) : (
            <>
              {/* 双色球分组 */}
              {groupedTickets.ssq.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginBottom: 16,
                      color: "#1e40af",
                    }}
                  >
                    🎯 双色球 ({groupedTickets.ssq.length} 条)
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>名称</TableHead>
                          <TableHead>号码</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedTickets.ssq.map((ticket: any) => (
                          <TableRow key={ticket.id}>
                            <TableCell>{ticket.name}</TableCell>
                            <TableCell>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  flexWrap: "wrap",
                                }}
                              >
                                {ticket.numbers.red.map(
                                  (num: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        display: "inline-block",
                                        width: 28,
                                        height: 28,
                                        lineHeight: "28px",
                                        borderRadius: "50%",
                                        background: "#e53e3e",
                                        color: "#fff",
                                        textAlign: "center",
                                        marginRight: 4,
                                        fontWeight: 600,
                                        fontSize: 12,
                                      }}
                                    >
                                      {num}
                                    </span>
                                  ),
                                )}
                                {ticket.numbers.blue.map(
                                  (num: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        display: "inline-block",
                                        width: 28,
                                        height: 28,
                                        lineHeight: "28px",
                                        borderRadius: "50%",
                                        background: "#2563eb",
                                        color: "#fff",
                                        textAlign: "center",
                                        marginLeft: 8,
                                        marginRight: 4,
                                        fontWeight: 600,
                                        fontSize: 12,
                                      }}
                                    >
                                      {num}
                                    </span>
                                  ),
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: 12,
                                  fontSize: 12,
                                  background: ticket.isActive
                                    ? "#d1fae5"
                                    : "#f3f4f6",
                                  color: ticket.isActive
                                    ? "#065f46"
                                    : "#6b7280",
                                }}
                              >
                                {ticket.isActive ? "激活" : "停用"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {formatDate(ticket.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => handleEditTicket(ticket)}
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    background: "#2563eb",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() =>
                                    handleToggleTicketActive(ticket)
                                  }
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    background: ticket.isActive
                                      ? "#f59e0b"
                                      : "#10b981",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  {ticket.isActive ? "停用" : "激活"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTicket(ticket.id)}
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    background: "#ef4444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  删除
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* 大乐透分组 */}
              {groupedTickets.dlt.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginBottom: 16,
                      color: "#dc2626",
                    }}
                  >
                    🎲 大乐透 ({groupedTickets.dlt.length} 条)
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>名称</TableHead>
                          <TableHead>号码</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedTickets.dlt.map((ticket: any) => (
                          <TableRow key={ticket.id}>
                            <TableCell>{ticket.name}</TableCell>
                            <TableCell>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  flexWrap: "wrap",
                                }}
                              >
                                {ticket.numbers.red.map(
                                  (num: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        display: "inline-block",
                                        width: 28,
                                        height: 28,
                                        lineHeight: "28px",
                                        borderRadius: "50%",
                                        background: "#e53e3e",
                                        color: "#fff",
                                        textAlign: "center",
                                        marginRight: 4,
                                        fontWeight: 600,
                                        fontSize: 12,
                                      }}
                                    >
                                      {num}
                                    </span>
                                  ),
                                )}
                                {ticket.numbers.blue.map(
                                  (num: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        display: "inline-block",
                                        width: 28,
                                        height: 28,
                                        lineHeight: "28px",
                                        borderRadius: "50%",
                                        background: "#2563eb",
                                        color: "#fff",
                                        textAlign: "center",
                                        marginLeft: 8,
                                        marginRight: 4,
                                        fontWeight: 600,
                                        fontSize: 12,
                                      }}
                                    >
                                      {num}
                                    </span>
                                  ),
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: 12,
                                  fontSize: 12,
                                  background: ticket.isActive
                                    ? "#d1fae5"
                                    : "#f3f4f6",
                                  color: ticket.isActive
                                    ? "#065f46"
                                    : "#6b7280",
                                }}
                              >
                                {ticket.isActive ? "激活" : "停用"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {formatDate(ticket.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => handleEditTicket(ticket)}
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    background: "#2563eb",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() =>
                                    handleToggleTicketActive(ticket)
                                  }
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    background: ticket.isActive
                                      ? "#f59e0b"
                                      : "#10b981",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  {ticket.isActive ? "停用" : "激活"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTicket(ticket.id)}
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    background: "#ef4444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  删除
                                </button>
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
              {groupedTickets.ssq.length === 0 &&
                groupedTickets.dlt.length === 0 && (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "#6b7280",
                      background: "#f9fafb",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <p style={{ fontSize: 16, marginBottom: 8 }}>
                      暂无预设号码
                    </p>
                    <p style={{ fontSize: 14 }}>
                      点击&ldquo;添加预设号码&rdquo;创建
                    </p>
                  </div>
                )}
              {ticketTotalPages > 1 && (
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
                          onClick={() => {
                            if (ticketPage > 1) {
                              setTicketPage(ticketPage - 1);
                            }
                          }}
                          style={{
                            cursor: ticketPage > 1 ? "pointer" : "not-allowed",
                            opacity: ticketPage > 1 ? 1 : 0.5,
                          }}
                        />
                      </PaginationItem>
                      {Array.from({ length: ticketTotalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          return (
                            page === 1 ||
                            page === ticketTotalPages ||
                            (page >= ticketPage - 1 && page <= ticketPage + 1)
                          );
                        })
                        .map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setTicketPage(page)}
                              isActive={ticketPage === page}
                              style={{ cursor: "pointer" }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => {
                            if (ticketPage < ticketTotalPages) {
                              setTicketPage(ticketPage + 1);
                            }
                          }}
                          style={{
                            cursor:
                              ticketPage < ticketTotalPages
                                ? "pointer"
                                : "not-allowed",
                            opacity: ticketPage < ticketTotalPages ? 1 : 0.5,
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
      )}

      {/* 邮箱管理 */}
      {activeTab === "emails" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <h2 style={{ fontSize: 20 }}>邮件收件人管理</h2>
            <button
              onClick={handleAddEmail}
              style={{
                padding: "8px 24px",
                fontSize: 16,
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              + 添加收件人
            </button>
          </div>

          {/* 添加/编辑表单 */}
          {showEmailForm && (
            <div
              style={{
                marginBottom: 24,
                padding: 20,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>
                {editingEmail ? "编辑收件人" : "添加收件人"}
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    邮箱地址 *
                  </label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="example@email.com"
                    style={{
                      width: "100%",
                      maxWidth: 400,
                      padding: "8px 12px",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    名称（可选）
                  </label>
                  <input
                    type="text"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                    placeholder="收件人名称"
                    style={{
                      width: "100%",
                      maxWidth: 400,
                      padding: "8px 12px",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={emailIsActive}
                      onChange={(e) => setEmailIsActive(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <span>激活（激活的收件人会收到中奖通知邮件）</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleSaveEmail}
                    disabled={
                      createEmailMutation.isPending ||
                      updateEmailMutation.isPending
                    }
                    style={{
                      padding: "8px 24px",
                      fontSize: 14,
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {createEmailMutation.isPending ||
                    updateEmailMutation.isPending
                      ? "保存中..."
                      : "保存"}
                  </button>
                  <button
                    onClick={() => {
                      setShowEmailForm(false);
                      setEditingEmail(null);
                    }}
                    style={{
                      padding: "8px 24px",
                      fontSize: 14,
                      background: "#6b7280",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 邮箱列表 */}
          {emailLoading ? (
            <div>加载中...</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邮箱地址</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailData?.data?.list.map((email: any) => (
                      <TableRow key={email.id}>
                        <TableCell>{email.email}</TableCell>
                        <TableCell>{email.name || "-"}</TableCell>
                        <TableCell>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: 12,
                              fontSize: 12,
                              background: email.isActive
                                ? "#d1fae5"
                                : "#f3f4f6",
                              color: email.isActive ? "#065f46" : "#6b7280",
                            }}
                          >
                            {email.isActive ? "激活" : "停用"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(email.createdAt)}</TableCell>
                        <TableCell>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => handleEditEmail(email)}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                background: "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleToggleEmailActive(email)}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                background: email.isActive
                                  ? "#f59e0b"
                                  : "#10b981",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              {email.isActive ? "停用" : "激活"}
                            </button>
                            <button
                              onClick={() => handleDeleteEmail(email.id)}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!emailData?.data?.list ||
                      emailData.data.list.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          style={{ textAlign: "center", color: "#6b7280" }}
                        >
                          暂无收件人，点击&ldquo;添加收件人&rdquo;创建
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {emailTotalPages > 1 && (
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
                          onClick={() => {
                            if (emailPage > 1) {
                              setEmailPage(emailPage - 1);
                            }
                          }}
                          style={{
                            cursor: emailPage > 1 ? "pointer" : "not-allowed",
                            opacity: emailPage > 1 ? 1 : 0.5,
                          }}
                        />
                      </PaginationItem>
                      {Array.from({ length: emailTotalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          return (
                            page === 1 ||
                            page === emailTotalPages ||
                            (page >= emailPage - 1 && page <= emailPage + 1)
                          );
                        })
                        .map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setEmailPage(page)}
                              isActive={emailPage === page}
                              style={{ cursor: "pointer" }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => {
                            if (emailPage < emailTotalPages) {
                              setEmailPage(emailPage + 1);
                            }
                          }}
                          style={{
                            cursor:
                              emailPage < emailTotalPages
                                ? "pointer"
                                : "not-allowed",
                            opacity: emailPage < emailTotalPages ? 1 : 0.5,
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
      )}
    </div>
  );
}
