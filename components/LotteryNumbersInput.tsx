"use client";

import React, { useRef, useEffect } from "react";

interface LotteryNumbersInputProps {
  lotteryType: "ssq" | "dlt";
  redNumbers: string[];
  blueNumbers: string[];
  onChange: (red: string[], blue: string[]) => void;
  disabled?: boolean;
}

export default function LotteryNumbersInput({
  lotteryType,
  redNumbers,
  blueNumbers,
  onChange,
  disabled = false,
}: LotteryNumbersInputProps) {
  const isSsq = lotteryType === "ssq";
  const redCount = isSsq ? 6 : 5;
  const blueCount = isSsq ? 1 : 2;
  const totalCount = redCount + blueCount;

  // 最大值范围配置
  const maxRed = isSsq ? 33 : 35;
  const maxBlue = isSsq ? 16 : 12;

  // 将红球和蓝球拼装为统一的 7 位数组，便于渲染与 ref 联动
  const allNumbers = [...redNumbers, ...blueNumbers];
  while (allNumbers.length < totalCount) {
    allNumbers.push("");
  }

  // 维护 7 个 input 的 DOM 引用
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 记录每个格子的最真实同步状态值，消除 React 异步渲染带来的 Props 延迟与 race condition
  const lastValuesRef = useRef<string[]>([]);
  const allNumbersStr = allNumbers.join(",");
  useEffect(() => {
    lastValuesRef.current = [...allNumbers];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNumbersStr]);

  // 确保 refs 数组长度符合要求
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, totalCount);
  }, [totalCount]);

  // 当外部红/蓝球数组发生变化或彩种切换时，确保数组长度正确
  useEffect(() => {
    let changed = false;
    const nextReds = [...redNumbers];
    const nextBlues = [...blueNumbers];

    while (nextReds.length < redCount) {
      nextReds.push("");
      changed = true;
    }
    if (nextReds.length > redCount) {
      nextReds.length = redCount;
      changed = true;
    }

    while (nextBlues.length < blueCount) {
      nextBlues.push("");
      changed = true;
    }
    if (nextBlues.length > blueCount) {
      nextBlues.length = blueCount;
      changed = true;
    }

    if (changed) {
      onChange(nextReds, nextBlues);
    }
  }, [lotteryType, redNumbers.length, blueNumbers.length, redCount, blueCount, onChange, redNumbers, blueNumbers]);

  // 修改特定索引处的数值并同步回父组件
  const updateNumberValue = (idx: number, newVal: string) => {
    // 立即进行同步更新，绕开 React 的 async setState 周期，防止连续输入时的 race condition
    lastValuesRef.current[idx] = newVal;

    const nextAll = [...allNumbers];
    nextAll[idx] = newVal;

    const nextReds = nextAll.slice(0, redCount);
    const nextBlues = nextAll.slice(redCount, totalCount);
    onChange(nextReds, nextBlues);
  };

  const handleInputChange = (val: string, idx: number) => {
    // 仅保留数字
    let cleanVal = val.replace(/\D/g, "");

    // 解决覆盖输入没有成功，反而与旧值发生拼接的问题
    // 如果原值是 2 位数且带有前导0，聚焦覆盖输入时，在某些平台会拼接成 3 位数（如 "01" -> "011"）
    // 此时我们直接从具备强时效性的 lastValuesRef 中取值，精确比对并提取出最新输入的那个单字符！
    const oldVal = lastValuesRef.current[idx] || "";
    if (oldVal.length === 2 && cleanVal.length === 3) {
      if (cleanVal.startsWith(oldVal)) {
        cleanVal = cleanVal.slice(2);
      } else if (cleanVal.endsWith(oldVal)) {
        cleanVal = cleanVal.slice(0, 1);
      } else {
        cleanVal = cleanVal.slice(-1);
      }
    }


    const isRedBall = idx < redCount;
    const maxVal = isRedBall ? maxRed : maxBlue;

    if (cleanVal.length === 1) {
      // 1 位数绝对不跳转，留在原地，方便输入 1 位数或等待第二位录入
      updateNumberValue(idx, cleanVal);
    } else if (cleanVal.length >= 2) {
      // 截取前两位
      cleanVal = cleanVal.slice(0, 2);
      const num = parseInt(cleanVal, 10);

      if (num > maxVal) {
        // 超出上限，强制截断为最大值的字符串 (带前导0)
        const formatted = maxVal.toString().padStart(2, "0");
        updateNumberValue(idx, formatted);
      } else if (num === 0) {
        // 不能为 00
        updateNumberValue(idx, "01");
      } else {
        updateNumberValue(idx, cleanVal);
      }

      // 只有在输入满 2 位数时，才自动跳转聚焦到下一个格子！
      if (idx < totalCount - 1) {
        inputRefs.current[idx + 1]?.focus();
      }
    } else {
      // 清空当前格
      updateNumberValue(idx, "");
    }
  };




  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace") {
      const currentVal = allNumbers[idx];
      // 当当前格为空，且不是第一格时，按 Backspace 回退到前一格并将前一格清空
      if (!currentVal && idx > 0) {
        e.preventDefault();
        updateNumberValue(idx - 1, "");
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  // 失去焦点时自动补全前导 0
  const handleBlur = (idx: number) => {
    // 必须从同步且没有时效延迟的 lastValuesRef 中取值，防止在 focus 跳格引起 onBlur 时读取到尚未 commit 的旧 props
    const val = lastValuesRef.current[idx] || "";
    if (val && val.length === 1) {
      const formatted = val.padStart(2, "0");
      updateNumberValue(idx, formatted);
    }
  };


  // 支持快捷粘贴整行号码 (用空格、逗号等分隔)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    // 匹配一到两位数字
    const numbers = pastedText.trim().match(/\d{1,2}/g) || [];
    if (numbers.length === 0) return;

    const nextAll = [...allNumbers];
    let fillCount = 0;

    for (let i = 0; i < totalCount - startIdx; i++) {
      const targetIdx = startIdx + i;
      const parsedNumStr = numbers[i];
      if (parsedNumStr) {
        const isRedBall = targetIdx < redCount;
        const maxVal = isRedBall ? maxRed : maxBlue;
        let num = parseInt(parsedNumStr, 10);
        
        // 范围限制
        if (num > maxVal) num = maxVal;
        if (num === 0) num = 1;

        nextAll[targetIdx] = num.toString().padStart(2, "0");
        fillCount++;
      }
    }

    const nextReds = nextAll.slice(0, redCount);
    const nextBlues = nextAll.slice(redCount, totalCount);
    onChange(nextReds, nextBlues);

    // 聚焦到最后一个已填充的输入框
    const finalFocusIdx = Math.min(startIdx + fillCount - 1, totalCount - 1);
    if (finalFocusIdx >= 0) {
      inputRefs.current[finalFocusIdx]?.focus();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap py-2 flex-1">
      {allNumbers.map((num, idx) => {
        const isRedBall = idx < redCount;
        const placeholderText = isRedBall ? (isSsq ? "红" : "前") : (isSsq ? "蓝" : "后");

        // 查重逻辑：如果在当前区域内出现次数超过 1，即标记为重复（空值不参与查重）
        let isDuplicate = false;
        if (num !== "") {
          if (isRedBall) {
            isDuplicate = allNumbers.slice(0, redCount).filter((n) => n === num).length > 1;
          } else {
            isDuplicate = allNumbers.slice(redCount, totalCount).filter((n) => n === num).length > 1;
          }
        }

        // 样式配置：红球/前区使用红色/橙黄色发光；蓝球/后区使用靛蓝/翠绿色发光
        let inputClass = "w-11 h-11 rounded-full text-center font-black text-sm outline-none border transition-all shadow-sm focus:ring-4 flex-shrink-0 ";
        
        if (isDuplicate) {
          // [Frontend Design] 重复错误状态修复：移除 scale 避免原生 input 圆角渲染 Bug 和裁切。
          // 纯红底 + 白字 + 强烈的红色光晕 + ring 扩散，视觉冲击力依然极强。
          inputClass += "bg-red-600 text-white border-red-700 shadow-[0_0_15px_rgba(220,38,38,0.8)] ring-4 ring-red-500/50 relative z-20 focus:bg-red-500 animate-[pulse_1s_ease-in-out_infinite]";
        } else if (isRedBall) {
          if (isSsq) {
            // 双色球红球：浅粉底、深红字，聚焦玫瑰红发光
            inputClass += "bg-rose-50 border-rose-100 text-rose-600 focus:bg-white focus:border-rose-500 focus:ring-rose-50 placeholder:text-rose-300";
          } else {
            // 大乐透前区：浅橘底、深橘黄字，聚焦琥珀色发光
            inputClass += "bg-amber-50 border-amber-100 text-amber-600 focus:bg-white focus:border-amber-500 focus:ring-amber-50 placeholder:text-amber-300";
          }
        } else {
          if (isSsq) {
            // 双色球蓝球：浅蓝底、深蓝字，聚焦靛蓝发光
            inputClass += "bg-indigo-50 border-indigo-100 text-indigo-600 focus:bg-white focus:border-indigo-500 focus:ring-indigo-50 placeholder:text-indigo-300";
          } else {
            // 大乐透后区：浅绿底、深绿字，聚焦翠绿发光
            inputClass += "bg-emerald-50 border-emerald-100 text-emerald-600 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50 placeholder:text-emerald-300";
          }
        }

        if (disabled) {
          inputClass += " opacity-50 cursor-not-allowed";
        }

        return (
          <React.Fragment key={idx}>
            {/* 红蓝球中间放置一条精致的分隔符 */}
            {idx === redCount && (
              <div className="w-[1px] h-6 bg-slate-200 mx-2 flex-shrink-0" />
            )}
            <input
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={2}
              disabled={disabled}
              value={num}
              onChange={(e) => handleInputChange(e.target.value, idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              onBlur={() => handleBlur(idx)}
              onFocus={(e) => {
                // 全选聚焦覆盖，消除 race condition 引起的拼字焦点跳跃 Bug
                e.target.select();
              }}
              onPaste={(e) => handlePaste(e, idx)}
              placeholder={placeholderText}
              className={inputClass}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
