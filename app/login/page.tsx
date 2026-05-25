"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../server/client";
import { ArrowRight, Lock, Mail, Database, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [regCode, setRegCode] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setSuccessText("");
      router.push("/");
      router.refresh(); // 刷新 Server Components 状态
    },
    onError: (err) => {
      setErrorText(err.message);
      setSuccessText("");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      setIsLogin(true);
      setErrorText("");
      setSuccessText("注册成功！请使用刚才注册的账户和密码进行登录。");
    },
    onError: (err) => {
      setErrorText(err.message);
      setSuccessText("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!email || !password) {
      setErrorText("请输入邮箱和密码");
      return;
    }

    if (isLogin) {
      loginMutation.mutate({ email, password });
    } else {
      if (!regCode) {
        setErrorText("请输入注册邀请码");
        return;
      }
      registerMutation.mutate({ email, password, regCode });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-slate-800 relative overflow-hidden font-sans selection:bg-rose-500/10">
      
      {/* 氛围背景微网格与柔和渐变 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-100/25 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/25 blur-[130px] rounded-full" />
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.3] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative w-full max-w-[480px] px-6 py-12 z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* 系统标志与标题区域 */}
        <div className="flex flex-col items-center justify-center mb-8 space-y-4">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white/85 border border-slate-200/80 shadow-[0_8px_30px_rgba(99,102,241,0.06)] backdrop-blur-xl text-indigo-600 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Database className="w-7 h-7 text-indigo-500 z-10" />
          </div>
          
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-600 text-[10px] uppercase tracking-[0.15em] font-bold mb-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
              智能彩票服务端
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              {isLogin ? "晴空对奖站" : "注册新账号"}
            </h1>
            <p className="text-slate-400 text-xs font-medium tracking-wide">
              {isLogin ? "请登录您的账户以开始使用智能比对" : "只需简单几步即可开启您的智能对奖之旅"}
            </p>
          </div>
        </div>

        {/* 核心玻璃拟态面板 */}
        <div className="relative rounded-[2.5rem] bg-white/70 border border-slate-200/60 p-8 shadow-[0_20px_50px_rgba(99,102,241,0.04)] backdrop-blur-xl overflow-hidden">
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            
            <div className="space-y-4.5">
              
              {/* 账号输入 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  账号邮箱
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入您的邮箱，例如 name@example.com"
                  className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium"
                />
              </div>

              {/* 密码输入 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  登录密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入您的密码"
                  className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium"
                />
              </div>

              {/* 邀请码输入（仅在注册时显示） */}
              {!isLogin && (
                <div className="space-y-1.5 animate-in fade-in duration-300">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    系统注册口令
                  </label>
                  <input
                    type="password"
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                    placeholder="请输入专属的系统注册邀请码"
                    className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium"
                  />
                </div>
              )}
            </div>

            {/* 错误提示气泡 */}
            {errorText && (
              <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700 font-semibold leading-relaxed">
                  <span className="font-bold text-[10px] block mb-0.5 text-rose-800 uppercase tracking-wider">错误提示</span>
                  {errorText}
                </div>
              </div>
            )}

            {/* 成功提示气泡 */}
            {successText && (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-700 font-semibold leading-relaxed">
                  <span className="font-bold text-[10px] block mb-0.5 text-emerald-800 uppercase tracking-wider">提示信息</span>
                  {successText}
                </div>
              </div>
            )}

            {/* 登录/注册按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm tracking-wider overflow-hidden disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
            >
              <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 transition-transform duration-300 group-hover:translate-x-0.5">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-white/80 animate-spin" />
                    <span className="font-bold tracking-wider">正在处理...</span>
                  </>
                ) : (
                  <>
                    <span>{isLogin ? "立即登录" : "注册并登录"}</span>
                    <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
              </div>
            </button>
          </form>

          {/* 切换登录与注册 */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorText("");
                setSuccessText("");
                setRegCode("");
              }}
              className="text-xs text-indigo-600 hover:text-indigo-500 font-bold transition-colors focus:outline-none"
            >
              {isLogin ? "还没有账号？立即免费注册" : "已有账号？立即返回登录"}
            </button>
          </div>

          {/* 底部状态 */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>晴空对奖系统安全运行中</span>
            <span>节点: {mounted ? window.location.hostname : '云端'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
