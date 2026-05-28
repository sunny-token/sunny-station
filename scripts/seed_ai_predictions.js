const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

// 1. 安全加载本地 .env 环境变量
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const databaseUrl = process.env.DATABASE_URL || "";

// 2. 核心防污染安全拦截锁 (Prisma Security Gate)
if (databaseUrl.includes("qkgdtrkwskekhdauaaqe")) {
  console.error("\n\x1b[41m\x1b[37m 🔥【操作被拦截：安全防线生效】 🔥 \x1b[0m");
  console.error("\x1b[31m无法向线上生产环境注入测试数据！\x1b[0m");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log("\n\x1b[36m🚀 开始为本地测试库注入高仿真 AI 预测数据...\x1b[0m\n");

  // 0. 注入真实开奖数据（含详细的各奖级中奖金额 Json 字段）
  console.log("🔴 正在写入双色球历史开奖结果...");
  const ssqResults = [
    {
      issueNumber: "2026050",
      openDate: new Date("2026-05-10T21:15:00Z"),
      openNumbers: { red: ["02", "09", "12", "18", "27", "33"], blue: ["05"] },
      ballOrder: "02,09,12,18,27,33,05",
      totalBet: "389,021,390",
      jackpot: "2,109,203,190",
      detail: "一等奖 2注, 二等奖 100注",
      prizeAmounts: [
        { level: "一等奖", amount: "5,000,000" },
        { level: "二等奖", amount: "150,000" },
        { level: "三等奖", amount: "3,000" },
        { level: "四等奖", amount: "200" },
        { level: "五等奖", amount: "10" },
        { level: "六等奖", amount: "5" },
        { level: "福运奖", amount: "5" }
      ]
    },
    {
      issueNumber: "2026051",
      openDate: new Date("2026-05-13T21:15:00Z"),
      openNumbers: { red: ["06", "11", "17", "22", "28", "30"], blue: ["14"] },
      ballOrder: "06,11,17,22,28,30,14",
      totalBet: "392,103,290",
      jackpot: "2,120,409,203",
      detail: "一等奖 5注, 二等奖 150注",
      prizeAmounts: [
        { level: "一等奖", amount: "5,000,000" },
        { level: "二等奖", amount: "150,000" },
        { level: "三等奖", amount: "3,000" },
        { level: "四等奖", amount: "200" },
        { level: "五等奖", amount: "10" },
        { level: "六等奖", amount: "5" },
        { level: "福运奖", amount: "5" }
      ]
    },
    {
      issueNumber: "2026052",
      openDate: new Date("2026-05-17T21:15:00Z"),
      openNumbers: { red: ["05", "10", "16", "22", "27", "31"], blue: ["06"] },
      ballOrder: "05,10,16,22,27,31,06",
      totalBet: "395,203,190",
      jackpot: "2,132,492,019",
      detail: "一等奖 3注, 二等奖 120注",
      prizeAmounts: [
        { level: "一等奖", amount: "5,000,000" },
        { level: "二等奖", amount: "150,000" },
        { level: "三等奖", amount: "3,000" },
        { level: "四等奖", amount: "200" },
        { level: "五等奖", amount: "10" },
        { level: "六等奖", amount: "5" },
        { level: "福运奖", amount: "5" }
      ]
    }
  ];

  for (const res of ssqResults) {
    await prisma.sSQResult.upsert({
      where: { issueNumber: res.issueNumber },
      update: res,
      create: res
    });
  }
  console.log("   - ✅ 双色球历史开奖数据注入成功！");

  console.log("🟢 正在写入大乐透历史开奖结果...");
  const dltResults = [
    {
      issueNumber: "26050",
      openDate: new Date("2026-05-11T20:30:00Z"),
      openNumbers: { red: ["04", "09", "18", "25", "30"], blue: ["03", "10"] },
      ballOrder: "04,09,18,25,30,03,10",
      totalBet: "298,102,390",
      jackpot: "1,090,203,190",
      detail: "一等奖 1注, 二等奖 80注",
      prizeAmounts: [
        { level: "一等奖", amount: "5,000,000" },
        { level: "二等奖", amount: "150,000" },
        { level: "三等奖", amount: "10,000" },
        { level: "四等奖", amount: "3,000" },
        { level: "五等奖", amount: "300" },
        { level: "六等奖", amount: "200" },
        { level: "七等奖", amount: "15" },
        { level: "八等奖", amount: "15" }
      ]
    },
    {
      issueNumber: "26051",
      openDate: new Date("2026-05-14T20:30:00Z"),
      openNumbers: { red: ["02", "07", "12", "19", "25"], blue: ["01", "07"] },
      ballOrder: "02,07,12,19,25,01,07",
      totalBet: "301,209,103",
      jackpot: "1,102,409,203",
      detail: "一等奖 4注, 二等奖 95注",
      prizeAmounts: [
        { level: "一等奖", amount: "5,000,000" },
        { level: "二等奖", amount: "150,000" },
        { level: "三等奖", amount: "10,000" },
        { level: "四等奖", amount: "3,000" },
        { level: "五等奖", amount: "300" },
        { level: "六等奖", amount: "200" },
        { level: "七等奖", amount: "15" },
        { level: "八等奖", amount: "15" }
      ]
    }
  ];

  for (const res of dltResults) {
    await prisma.dLTResult.upsert({
      where: { issueNumber: res.issueNumber },
      update: res,
      create: res
    });
  }
  console.log("   - ✅ 大乐透历史开奖数据注入成功！");

  // 清空原有的 AI 预测数据
  await prisma.aIPrediction.deleteMany({});
  console.log("🧹 历史 AI 预测旧数据清理完成。");

  // 1. 注入双色球 (ssq) 的 AI 预测历史 (已开奖)
  console.log("🔴 正在注入双色球 AI 预测记录...");
  const ssqData = [
    {
      lotteryType: "ssq",
      issueNumber: "2026050",
      status: "OPENED",
      predictedNumbers: [
        { red: ["02", "07", "12", "18", "25", "32"], blue: ["05"], reason: "红球遗漏期数回归，蓝球大底冷号拉升" },
        { red: ["03", "08", "15", "20", "26", "30"], blue: ["12"], reason: "马尔可夫链和值平稳态解算号码" },
        { red: ["01", "10", "14", "19", "24", "31"], blue: ["09"], reason: "邻号及重号高频区重合推演" },
        { red: ["05", "11", "16", "22", "27", "29"], blue: ["03"], reason: "奇偶对称比率及三分区平衡选定" },
        { red: ["04", "09", "13", "21", "28", "33"], blue: ["16"], reason: "冷温热三因子权重融合结果" }
      ],
      openNumbers: { red: ["02", "09", "12", "18", "27", "33"], blue: ["05"] },
      hitDetail: [
        { redHit: 3, blueHit: 1, isWinner: true, prize: "五等奖", description: "中3红1蓝" }, // 命中 02, 12, 18 + 05
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 2, blueHit: 0, isWinner: false, prize: "未中奖", description: "" }, // 05, 27
        { redHit: 2, blueHit: 0, isWinner: false, prize: "未中奖", description: "" }  // 09, 33
      ]
    },
    {
      lotteryType: "ssq",
      issueNumber: "2026051",
      status: "OPENED",
      predictedNumbers: [
        { red: ["01", "08", "13", "19", "24", "30"], blue: ["07"], reason: "历史同期冷温号复出趋势" },
        { red: ["06", "11", "17", "22", "28", "31"], blue: ["14"], reason: "极值斜率收敛区间首选" },
        { red: ["03", "10", "15", "21", "26", "29"], blue: ["08"], reason: "同尾数高发组合排查最优" },
        { red: ["04", "09", "16", "20", "25", "32"], blue: ["02"], reason: "高概率波峰红球定位选取" },
        { red: ["05", "12", "18", "23", "27", "33"], blue: ["11"], reason: "质合对称形态优化推荐" }
      ],
      openNumbers: { red: ["06", "11", "17", "22", "28", "30"], blue: ["14"] },
      hitDetail: [
        { redHit: 1, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 5, blueHit: 1, isWinner: true, prize: "三等奖", description: "中5红1蓝，差一球中头奖！" }, // 06, 11, 17, 22, 28 + 14
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 1, blueHit: 0, isWinner: false, prize: "未中奖", description: "" }
      ]
    },
    {
      lotteryType: "ssq",
      issueNumber: "2026052",
      status: "OPENED",
      predictedNumbers: [
        { red: ["02", "06", "11", "17", "23", "29"], blue: ["04"], reason: "全奇数对称回暖测试" },
        { red: ["04", "09", "15", "21", "26", "32"], blue: ["10"], reason: "和值回归稳态最优选择" },
        { red: ["03", "08", "12", "19", "25", "31"], blue: ["13"], reason: "斜连号回暖，偶数底数推荐" },
        { red: ["01", "07", "14", "18", "24", "30"], blue: ["06"], reason: "蓝球温号补位，红球杀热选择" },
        { red: ["05", "10", "16", "22", "27", "33"], blue: ["15"], reason: "奇偶对称最佳概率比率解算" }
      ],
      openNumbers: { red: ["05", "10", "16", "22", "27", "31"], blue: ["06"] },
      hitDetail: [
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 2, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 1, blueHit: 1, isWinner: true, prize: "六等奖", description: "中1红1蓝" }, // 31 + 06
        { redHit: 5, blueHit: 0, isWinner: true, prize: "四等奖", description: "中5红0蓝" } // 05, 10, 16, 22, 27
      ]
    },
    {
      lotteryType: "ssq",
      issueNumber: "2026053",
      status: "PENDING", // 等待开奖展示
      predictedNumbers: [
        { red: ["01", "06", "12", "18", "24", "30"], blue: ["08"], reason: "下期高热防守号推演" },
        { red: ["03", "09", "15", "21", "27", "33"], blue: ["12"], reason: "全奇数概率波峰回归" },
        { red: ["05", "10", "14", "19", "25", "29"], blue: ["04"], reason: "冷温号交叉配比推荐" },
        { red: ["02", "07", "11", "17", "22", "28"], blue: ["15"], reason: "斜连号三连击高频区间" },
        { red: ["04", "08", "13", "20", "26", "31"], blue: ["01"], reason: "马尔可夫链稳态预测解算" }
      ]
    }
  ];

  for (const ssq of ssqData) {
    await prisma.aIPrediction.create({
      data: {
        lotteryType: ssq.lotteryType,
        issueNumber: ssq.issueNumber,
        status: ssq.status,
        predictedNumbers: ssq.predictedNumbers,
        openNumbers: ssq.openNumbers || null,
        hitDetail: ssq.hitDetail || null
      }
    });
  }
  console.log("   - ✅ 双色球测试预测数据写入成功！");

  // 2. 注入大乐透 (dlt) 的 AI 预测历史 (已开奖)
  console.log("\n🟢 正在注入大乐透 AI 预测记录...");
  const dltData = [
    {
      lotteryType: "dlt",
      issueNumber: "26050",
      status: "OPENED",
      predictedNumbers: [
        { red: ["04", "11", "18", "25", "32"], blue: ["03", "08"], reason: "前区偶数回补，后区热号稳健组合" },
        { red: ["02", "09", "15", "22", "30"], blue: ["01", "10"], reason: "斜连号形态与和值均衡最优解" },
        { red: ["07", "13", "20", "27", "34"], blue: ["06", "11"], reason: "极值斜率温号复出推演" },
        { red: ["05", "10", "17", "24", "31"], blue: ["04", "09"], reason: "奇偶对称最佳概率区间定位" },
        { red: ["03", "08", "16", "23", "29"], blue: ["05", "12"], reason: "前区冷号拉升，后区双偶数防守" }
      ],
      openNumbers: { red: ["04", "09", "18", "25", "30"], blue: ["03", "10"] },
      hitDetail: [
        { redHit: 3, blueHit: 1, isWinner: true, prize: "八等奖", description: "中3+1" }, // 04, 18, 25 + 03
        { redHit: 2, blueHit: 1, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 1, blueHit: 0, isWinner: false, prize: "未中奖", description: "" }
      ]
    },
    {
      lotteryType: "dlt",
      issueNumber: "26051",
      status: "OPENED",
      predictedNumbers: [
        { red: ["01", "08", "14", "20", "28"], blue: ["02", "07"], reason: "马尔可夫链和值平稳态解算" },
        { red: ["05", "11", "20", "27", "33"], blue: ["04", "08"], reason: "同尾数高发组合收敛优化" },
        { red: ["03", "10", "17", "24", "31"], blue: ["05", "09"], reason: "奇偶对称最佳比率形态推荐" },
        { red: ["02", "07", "12", "19", "25"], blue: ["01", "06"], reason: "前区极极大可能热号，后区冷温配合" },
        { red: ["06", "13", "18", "23", "30"], blue: ["10", "12"], reason: "后区高频热号定位，前区防守" }
      ],
      openNumbers: { red: ["02", "07", "12", "19", "25"], blue: ["01", "07"] },
      hitDetail: [
        { redHit: 0, blueHit: 1, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 1, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" },
        { redHit: 5, blueHit: 1, isWinner: true, prize: "二等奖", description: "中5+1！距离一等奖仅差后区一球！" }, // 02, 07, 12, 19, 25 + 01
        { redHit: 0, blueHit: 0, isWinner: false, prize: "未中奖", description: "" }
      ]
    }
  ];

  for (const dlt of dltData) {
    await prisma.aIPrediction.create({
      data: {
        lotteryType: dlt.lotteryType,
        issueNumber: dlt.issueNumber,
        status: dlt.status,
        predictedNumbers: dlt.predictedNumbers,
        openNumbers: dlt.openNumbers || null,
        hitDetail: dlt.hitDetail || null
      }
    });
  }
  console.log("   - ✅ 大乐透测试预测数据写入成功！");

  console.log("\n\x1b[32m✨ 恭喜！高仿真 AI 预测与战绩测试数据已成功注入！✨\x1b[0m");
  console.log("💡 现在在本地打开 AI 测算页面，即可立刻看到酷炫的 AI 实战战绩看板效果啦！\n");
}

main()
  .catch((e) => {
    console.error("\n❌ 注入过程中发生错误:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
