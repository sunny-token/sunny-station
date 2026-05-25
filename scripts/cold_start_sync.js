/**
 * Sunny Station 冷启动与历史详情平滑补全修补工具 (挂机提速版)
 * 
 * 用途: 
 *   通过直连数据库，全自动、分批平滑拉取大乐透 (DLT) 和双色球 (SSQ) 缺失的 prizeDetailHtml 详情。
 *   支持平滑并发控制、平滑冷却延迟、断点续传、失败智能重试以及极其精美的终端可视化进度指示。
 * 
 * 运行方式:
 *   node scripts/cold_start_sync.js [选项]
 * 
 * 选项:
 *   --type=<dlt|ssq|all>      同步彩票类型 (默认: all)
 *   --concurrent=<number>     并发请求限制 (默认: 3)
 *   --delay=<ms>              平滑冷却延迟 (默认: 150ms)
 *   --limit=<number>          单次最大修补条数 (默认: 2000, 0表示无限制)
 *   --retry=<number>          失败重试次数 (默认: 3)
 */

const { PrismaClient } = require("@prisma/client");
const cheerio = require("cheerio");

// 载入环境变量 (如 DATABASE_URL)
try {
  require("dotenv").config();
} catch (e) {
  // Prisma 客户端在实例化时会自动从 .env 中读取 DATABASE_URL，即使 dotenv 未安装也无妨
}

const prisma = new PrismaClient();

// 命令行参数解析
const args = {};
process.argv.slice(2).forEach(arg => {
  const [key, val] = arg.split("=");
  if (key.startsWith("--")) {
    const k = key.replace("--", "");
    args[k] = val;
  }
});

const CONFIG = {
  type: args.type || "all",
  concurrent: args.concurrent !== undefined ? parseInt(args.concurrent) : 3,
  delay: args.delay !== undefined ? parseInt(args.delay) : 150,
  limit: args.limit !== undefined ? parseInt(args.limit) : 2000,
  retry: args.retry !== undefined ? parseInt(args.retry) : 3,
};

// 纯原生高性能异步并发控制限流池
async function limitConcurrent(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = Promise.resolve()
      .then(() => task())
      .then((res) => {
        results[i] = res;
      });
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// 模拟等待
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 从 getdetail 接口获取奖项奖金信息
async function fetchPrizeDetailsWithRetry(lotType, issue, attempt = 1) {
  try {
    const res = await fetch("https://www.17500.cn/api/kaijiang/getdetail", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `lotid=${lotType}&issue=${issue}&isone=1`,
      signal: AbortSignal.timeout(10000), // 10秒超时
    });
    
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const html = await res.text();
    if (!html || html.trim().length === 0 || html.includes("502 Bad Gateway") || html.includes("error")) {
      throw new Error("返回的数据格式不正确或为空");
    }

    const $ = cheerio.load(html);
    const prizeDetailHtml = html;

    // 查找奖项奖金表格
    const prizeDetails = [];
    const rows = $("table tbody tr").toArray();

    for (let i = 0; i < rows.length; i++) {
      const tds = $(rows[i]).find("td");
      if (tds.length < 5) continue;

      const level = $(tds[0]).text().trim();
      const perAmountText = $(tds[2]).text().trim();
      const prizeText = $(tds[4]).text().trim();

      let amountText = perAmountText;
      if (prizeText && prizeText !== "浮动奖" && /[\d,，]+/.test(prizeText)) {
        amountText = prizeText;
      }

      const amountMatch = amountText.match(/[\d,，]+/);
      if (level && amountMatch) {
        const amount = amountMatch[0].replace(/[，,]/g, "");
        if (amount && !isNaN(parseInt(amount, 10))) {
          prizeDetails.push({ level, amount });
        }
      }
    }

    return {
      prizeAmounts: prizeDetails.length > 0 ? prizeDetails : null,
      prizeDetailHtml,
    };
  } catch (error) {
    if (attempt < CONFIG.retry) {
      const backoff = attempt * 1000;
      await sleep(backoff);
      return fetchPrizeDetailsWithRetry(lotType, issue, attempt + 1);
    }
    throw error;
  }
}

// 终端炫酷画廊与彩字效果
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  fgWhite: "\x1b[37m",
  
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m"
};

function formatProgress(current, total, startTime, typeLabel) {
  const percent = ((current / total) * 100).toFixed(1);
  const width = 30;
  const completedWidth = Math.round((current / total) * width);
  const remainingWidth = width - completedWidth;
  
  const bar = colors.fgGreen + "█".repeat(completedWidth) + colors.bgBlack + "░".repeat(remainingWidth) + colors.reset;
  
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = current / elapsed; // items per second
  const remaining = total - current;
  const eta = speed > 0 ? Math.round(remaining / speed) : 0;
  
  const minutes = Math.floor(eta / 60);
  const seconds = eta % 60;
  const etaStr = speed > 0 ? `${minutes}分${seconds}秒` : "计算中...";
  
  return `  ${colors.bright}${typeLabel}${colors.reset} [${bar}] ${colors.fgCyan}${percent}%${colors.reset} (${current}/${total}) | 速度: ${colors.fgYellow}${speed.toFixed(1)}期/秒${colors.reset} | 剩余时间: ${colors.fgMagenta}${etaStr}${colors.reset}`;
}

async function syncLotteryType(lotType, typeLabel, modelName) {
  console.log(`\n${colors.fgBlue}============================================================${colors.reset}`);
  console.log(`[SYNC] 开始扫描 ${colors.bright}${typeLabel}${colors.reset} (${modelName}) 数据库中缺失的详情...`);
  
  const dbModel = prisma[modelName];
  
  // 找出所有缺失 prizeDetailHtml 详情的期号
  const missingRecords = await dbModel.findMany({
    where: {
      prizeDetailHtml: null,
    },
    orderBy: {
      issueNumber: "asc",
    },
    select: {
      issueNumber: true,
      openDate: true,
    }
  });

  if (missingRecords.length === 0) {
    console.log(`[SYNC] ${colors.fgGreen}✅ 所有期数已具备详情，无需修补。${colors.reset}`);
    return;
  }

  console.log(`[SYNC] 共检测到 ${colors.fgYellow}${missingRecords.length}${colors.reset} 期缺失详情。`);
  
  let recordsToProcess = missingRecords;
  if (CONFIG.limit > 0 && missingRecords.length > CONFIG.limit) {
    recordsToProcess = missingRecords.slice(0, CONFIG.limit);
    console.log(`[SYNC] ⚠️ 本次同步配置了最大修补限制 (--limit=${CONFIG.limit})，将处理前 ${colors.fgYellow}${CONFIG.limit}${colors.reset} 期。`);
  }

  const total = recordsToProcess.length;
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  
  console.log(`[SYNC] 并发限制: ${colors.fgCyan}${CONFIG.concurrent}${colors.reset}，平滑延迟: ${colors.fgCyan}${CONFIG.delay}ms`);
  console.log(`[SYNC] 开始拉取详情并逐步入库...`);

  // 构建批次执行
  const tasks = recordsToProcess.map((record, index) => {
    return async () => {
      const issue = record.issueNumber;
      try {
        const prizeDetails = await fetchPrizeDetailsWithRetry(lotType, issue);
        
        // 写入数据库
        await dbModel.update({
          where: { issueNumber: issue },
          data: {
            prizeAmounts: prizeDetails.prizeAmounts || undefined,
            prizeDetailHtml: prizeDetails.prizeDetailHtml || undefined,
          }
        });
        
        successCount++;
      } catch (error) {
        failCount++;
        // 打印错误但是不中断整体流程
        console.log(`\n${colors.fgRed}[ERROR] 期号 ${issue} 同步失败: ${error.message}${colors.reset}`);
      }

      // 平滑冷却延迟
      if (CONFIG.delay > 0) {
        await sleep(CONFIG.delay);
      }

      // 更新终端进度条 (利用 \r 回车覆写当前行)
      process.stdout.write(`\r${formatProgress(successCount + failCount, total, startTime, typeLabel)}`);
    };
  });

  // 并发微任务池调度
  await limitConcurrent(tasks, CONFIG.concurrent);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n[SYNC] ${colors.fgGreen}🎉 ${typeLabel} 补全流程结束!${colors.reset}`);
  console.log(`       耗时: ${duration} 秒`);
  console.log(`       成功: ${colors.fgGreen}${successCount} 条${colors.reset}`);
  console.log(`       失败: ${colors.fgRed}${failCount} 条${colors.reset}`);
}

async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.fgYellow}
   _____                               _____ _        _   _             
  / ____|                             / ____| |      | | (_)            
 | (___  _   _ _ __  _ __  _   _     | (___ | |_ __ _| |_ _  ___  _ __  
  \\___ \\| | | | '_ \\| '_ \\| | | |     \\___ \\| __/ _\` | __| |/ _ \\| '_ \\ 
  ____) | |_| | | | | | | | |_| |     ____) | || (_| | |_| | (_) | | | |
 |_____/ \\__,_|_| |_|_| |_|\\__, |    |_____/ \\__\\__,_|\\__|_|\\___/|_| |_|
                            __/ |                                       
                           |___/  冷启动与历史数据补齐修补工具
${colors.reset}`);

  console.log(`${colors.fgCyan}====================== 运维修补配置 ======================${colors.reset}`);
  console.log(` 彩票类型:  ${colors.bright}${CONFIG.type.toUpperCase()}${colors.reset}`);
  console.log(` 并发限制:  ${colors.bright}${CONFIG.concurrent}${colors.reset}`);
  console.log(` 冷却延迟:  ${colors.bright}${CONFIG.delay} ms`);
  console.log(` 单次限制:  ${colors.bright}${CONFIG.limit === 0 ? "无限制" : CONFIG.limit + " 期"}${colors.reset}`);
  console.log(` 重试次数:  ${colors.bright}${CONFIG.retry} 次`);
  console.log(`${colors.fgCyan}==========================================================${colors.reset}`);

  try {
    // 验证数据库连接
    await prisma.$queryRaw`SELECT 1`;
    console.log(`${colors.fgGreen}✅ 数据库直连成功!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.fgRed}❌ 数据库连接失败: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    if (CONFIG.type === "ssq" || CONFIG.type === "all") {
      await syncLotteryType("ssq", "双色球 (SSQ)", "sSQResult");
    }
    
    if (CONFIG.type === "dlt" || CONFIG.type === "all") {
      await syncLotteryType("dlt", "大乐透 (DLT)", "dLTResult");
    }
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${colors.fgGreen}============================================================${colors.reset}`);
    console.log(`✨ 全量运维同步圆满完成！总耗时: ${totalDuration} 秒`);
    console.log(`${colors.fgGreen}============================================================${colors.reset}\n`);
  } catch (error) {
    console.error(`\n❌ 同步过程中发生未知错误:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
