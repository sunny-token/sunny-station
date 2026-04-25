"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../server/client";
import { ArrowRight, Fingerprint, ScanEye, TerminalSquare, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh(); // 刷新 Server Components 状态
    },
    onError: (err) => {
      setErrorText(err.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      setIsLogin(true);
      setErrorText("");
      // 成功后自动切换回登录态，可选提示
    },
    onError: (err) => {
      setErrorText(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (!email || !password) {
      setErrorText("请输入邮箱和密码");
      return;
    }

    if (isLogin) {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-slate-200 relative overflow-hidden font-sans selection:bg-red-500/30">
      
      {/* 工业级氛围背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-900/10 blur-[150px] rounded-full animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-black blur-[150px] rounded-full" />
        
        {/* 点阵网格层 */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] pointer-events-none" />
      </div>

      <div className="relative w-full max-w-[480px] px-6 py-12 z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* 系统标志区域 */}
        <div className="flex flex-col items-center justify-center mb-10 space-y-4">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.05] shadow-[0_0_30px_rgba(220,38,38,0.15)] group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <ScanEye className="w-8 h-8 text-white z-10" />
            
            {/* 顶角装饰 */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-500/50" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-500/50" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-red-500/50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-red-500/50" />
          </div>
          
          <div className="text-center space-y-1">
             <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
              身份安全验证
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              系统登录
            </h1>
            <p className="text-slate-500 text-xs font-mono tracking-widest uppercase mt-1">
              Administrator Login
            </p>
          </div>
        </div>

        {/* 核心面板 */}
        <div className="relative rounded-[2rem] bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/[0.06] p-8 shadow-2xl overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.02] before:to-transparent before:pointer-events-none">
          

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              
              <div className="space-y-4">
                <div className="space-y-1.5 focus-within:text-white text-slate-500 transition-colors">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]">
                    <TerminalSquare className="w-3.5 h-3.5" />
                    电子邮箱
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@internal.sys"
                    className="w-full h-14 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:ring-0 focus:border-red-500/50 transition-all text-white placeholder:text-slate-700 font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5 focus-within:text-white text-slate-500 transition-colors">
                   <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]">
                    <Fingerprint className="w-3.5 h-3.5" />
                    登录密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-14 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:ring-0 focus:border-red-500/50 transition-all text-white placeholder:text-slate-700 font-serif text-2xl tracking-widest"
                  />
                </div>
              </div>

              {errorText && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-400 font-medium leading-relaxed">
                    <span className="font-bold uppercase tracking-wider text-[10px] block mb-1">错误提示</span>
                    {errorText}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full h-14 rounded-xl bg-white text-black font-black text-sm uppercase tracking-[0.2em] overflow-hidden disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.98]"
              >
                <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 transition-transform duration-300 group-hover:translate-x-1">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                      <span className="tracking-[0.3em]">处理中...</span>
                    </>
                  ) : (
                    <>
                      登录
                      <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </div>
              </button>
            </form>

          <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono uppercase tracking-widest text-[10px]">安全协议运行中</span>
            <span className="font-mono uppercase tracking-widest text-[10px]">接入节点: {mounted ? window.location.hostname : '云端'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
