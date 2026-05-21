const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

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
  console.error("\n\x1b[41m\x1b[37m 🔥【高危警报：操作被安全系统拦截】 🔥 \x1b[0m");
  console.error("\x1b[31m检测到当前 DATABASE_URL 指向【线上生产库 (qkgdtrkwskekhdauaaqe)】！\x1b[0m");
  console.error("\x1b[31m为了确保线上生产环境数据的绝对安全，禁止在生产库上运行任何测试注入脚本。\x1b[0m");
  console.error("\x1b[33m请先在本地终端运行: \x1b[32mnode scripts/switch_env.js dev\x1b[0m\x1b[33m 切换到测试库，然后再执行此脚本。\x1b[0m\n");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log("\n\x1b[36m🚀 开始为本地测试库注入高品质开发数据与测试账号...\x1b[0m\n");

  // 3. 生成统一的测试哈希密码 (默认密码: 123456)
  const passwordHash = await bcrypt.hash("123456", 10);

  // 4. 清理旧测试数据以保持幂等性 (只在安全测试库上执行)
  console.log("🧹 正在清理旧有测试关联数据 (Ticket, EmailRecipient, SSQResult, DLTResult)...");
  await prisma.ticket.deleteMany({});
  await prisma.emailRecipient.deleteMany({});
  await prisma.sSQResult.deleteMany({});
  await prisma.dLTResult.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("✅ 旧数据清理完毕。");

  // 5. 注入测试账号
  console.log("\n👤 正在注入测试账号 (密码均为: 123456)...");
  
  // 管理员账号
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: passwordHash,
      name: "超级管理员 (Admin)",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`   - 🛡️ 管理员创建成功: [${adminUser.email}]`);

  // 普通用户账号
  const regularUser = await prisma.user.create({
    data: {
      email: "user@example.com",
      password: passwordHash,
      name: "普通彩民 (User)",
      role: "USER",
      isActive: true,
    },
  });
  console.log(`   - 🧑 普通用户创建成功: [${regularUser.email}]`);

  // 访客账号
  const guestUser = await prisma.user.create({
    data: {
      email: "guest@example.com",
      password: passwordHash,
      name: "观光游客 (Guest)",
      role: "GUEST",
      isActive: true,
    },
  });
  console.log(`   - 👁️ 访客用户创建成功: [${guestUser.email}]`);

  // 6. 注入通知邮箱配置 (EmailRecipient)
  console.log("\n📧 正在为用户注入测试邮件通知接收节点...");
  
  await prisma.emailRecipient.createMany({
    data: [
      {
        userId: adminUser.id,
        email: "admin-alert@example.com",
        name: "管理员主备用邮箱",
        isActive: true,
      },
      {
        userId: adminUser.id,
        email: "admin-sec@example.com",
        name: "管理员紧急抄送箱",
        isActive: false, // 测试未激活状态
      },
      {
        userId: regularUser.id,
        email: "user-notify@example.com",
        name: "普通用户个人邮箱",
        isActive: true,
      }
    ],
  });
  console.log("   - ✅ 邮件接收配置注入成功！");

  // 7. 注入预设号码测试数据 (Ticket)
  console.log("\n🎟️ 正在注入测试预设彩票号码 (Tickets)...");
  
  await prisma.ticket.createMany({
    data: [
      // 管理员的彩票方案
      {
        userId: adminUser.id,
        lotteryType: "ssq",
        name: "管理员-双色球心水号一",
        numbers: { red: ["01", "08", "12", "18", "25", "30"], blue: ["09"] },
        isActive: true,
      },
      {
        userId: adminUser.id,
        lotteryType: "dlt",
        name: "管理员-大乐透追加号",
        numbers: { red: ["05", "11", "20", "28", "33"], blue: ["02", "10"] },
        isActive: true,
      },
      // 普通用户的彩票方案
      {
        userId: regularUser.id,
        lotteryType: "ssq",
        name: "普通彩民-双色球机选大奖号",
        numbers: { red: ["02", "09", "16", "23", "27", "32"], blue: ["06"] },
        isActive: true,
      },
      {
        userId: regularUser.id,
        lotteryType: "dlt",
        name: "普通彩民-大乐透守号方案",
        numbers: { red: ["07", "12", "19", "25", "31"], blue: ["04", "08"] },
        isActive: false, // 未激活状态
      }
    ],
  });
  console.log("   - ✅ 预设号码 (Tickets) 注入成功！");

  // 8. 注入历史彩票开奖数据 (SSQResult & DLTResult)
  console.log("\n📈 正在注入历史彩票开奖对照数据...");

  // 双色球开奖结果
  await prisma.sSQResult.createMany({
    data: [
      {
        issueNumber: "2024001",
        openDate: new Date("2024-01-02T21:15:00.000Z"),
        openNumbers: { red: ["01", "08", "12", "18", "25", "30"], blue: ["09"] }, // 精准命中管理员的心水号一（一等奖测试）
        ballOrder: "01 08 12 18 25 30 09",
        totalBet: "389,120,442",
        jackpot: "1,024,556,128",
        detail: JSON.stringify({
          prizeLevels: [
            { level: "一等奖", count: "3", amount: "10,000,000" },
            { level: "二等奖", count: "89", amount: "185,000" }
          ]
        }),
        prizeAmounts: [
          { level: "一等奖", amount: "10000000" },
          { level: "二等奖", amount: "185000" }
        ],
      },
      {
        issueNumber: "2024002",
        openDate: new Date("2024-01-04T21:15:00.000Z"),
        openNumbers: { red: ["03", "07", "15", "21", "28", "33"], blue: ["11"] },
        ballOrder: "15 03 33 21 07 28 11",
        totalBet: "392,548,221",
        jackpot: "1,048,655,902",
        detail: JSON.stringify({
          prizeLevels: [
            { level: "一等奖", count: "12", amount: "5,800,000" },
            { level: "二等奖", count: "145", amount: "120,000" }
          ]
        }),
        prizeAmounts: [
          { level: "一等奖", amount: "5800000" },
          { level: "二等奖", amount: "120000" }
        ],
      }
    ],
  });

  // 大乐透开奖结果
  await prisma.dLTResult.createMany({
    data: [
      {
        issueNumber: "24001",
        openDate: new Date("2024-01-03T20:30:00.000Z"),
        openNumbers: { red: ["05", "11", "20", "28", "33"], blue: ["02", "10"] }, // 精准命中管理员的追加方案
        ballOrder: "05 20 11 33 28 02 10",
        totalBet: "298,452,112",
        jackpot: "812,050,455",
        detail: JSON.stringify({
          prizeLevels: [
            { level: "一等奖", count: "1", amount: "10,000,000" },
            { level: "一等奖追加", count: "1", amount: "8,000,000" }
          ]
        }),
        prizeAmounts: [
          { level: "一等奖", amount: "10000000" },
          { level: "一等奖追加", amount: "8000000" }
        ],
      },
      {
        issueNumber: "24002",
        openDate: new Date("2024-01-05T20:30:00.000Z"),
        openNumbers: { red: ["04", "10", "18", "24", "30"], blue: ["03", "07"] },
        ballOrder: "18 04 30 10 24 07 03",
        totalBet: "302,448,552",
        jackpot: "835,112,440",
        detail: JSON.stringify({
          prizeLevels: [
            { level: "一等奖", count: "5", amount: "7,500,000" }
          ]
        }),
        prizeAmounts: [
          { level: "一等奖", amount: "7500000" }
        ],
      }
    ],
  });
  console.log("   - ✅ 历史开奖对照数据注入成功！");

  console.log("\n\x1b[32m✨ 恭喜！测试账号和完整的开发测试数据已成功注入！✨\x1b[0m");
  console.log("-----------------------------------------------------------------");
  console.log("\x1b[33m🔑 可用于登录的测试账号及角色：\x1b[0m");
  console.log("   1. \x1b[1m管理员账号\x1b[0m:  \x1b[36madmin@example.com\x1b[0m  (密码: \x1b[32m123456\x1b[0m)");
  console.log("   2. \x1b[1m普通彩民\x1b[0m:    \x1b[36muser@example.com\x1b[0m   (密码: \x1b[32m123456\x1b[0m)");
  console.log("   3. \x1b[1m观光游客\x1b[0m:    \x1b[36mguest@example.com\x1b[0m  (密码: \x1b[32m123456\x1b[0m)");
  console.log("-----------------------------------------------------------------");
  console.log("💡 \x1b[90m提示：你可以使用这些账号登录你的本地站点 (http://localhost:3000) 体验完整的防横向越权拦截、邮件通知绑定及中奖通知匹配啦！\x1b[0m\n");
}

main()
  .catch((e) => {
    console.error("\n❌ 注入过程中发生致命错误:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
