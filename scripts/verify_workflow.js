const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

// 加载 .env 环境变量
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
if (databaseUrl.includes("qkgdtrkwskekhdauaaqe")) {
  console.log("\n\x1b[33m⚠️【数据安全警示】当前正在连接【正式生产库】(qkgdtrkwskekhdauaaqe)！操作需极其谨慎。\x1b[0m\n");
}

const prisma = new PrismaClient();

const usage = `
⚙️  SunnyStation 角色管理控制台
---------------------------------------------
可用命令:
  node scripts/verify_workflow.js promote <email>     - 将用户提升为管理员 (ADMIN)
  node scripts/verify_workflow.js demote <email>      - 将用户变更为普通用户 (USER)
  node scripts/verify_workflow.js demote-to-guest <email> - 将用户变更为访客 (GUEST)
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(usage);
    process.exit(0);
  }

  try {
    switch (command) {
      case "promote":
        await promoteUser(args[1]);
        break;
      case "demote":
        await demoteUser(args[1]);
        break;
      case "demote-to-guest":
        await demoteToGuestUser(args[1]);
        break;
      default:
        console.log(`❌ 未知命令: ${command}`);
        console.log(usage);
    }
  } catch (error) {
    console.error("❌ 执行出错:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// 提权用户
async function promoteUser(email) {
  if (!email) {
    console.log("❌ 请指定邮箱，例如: node scripts/verify_workflow.js promote test@example.com");
    return;
  }
  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });
  console.log(`\n\x1b[32m✅ 提权成功！用户 [${user.email}] 已被提升为 ADMIN 管理员。\x1b[0m\n`);
}

// 降权用户
async function demoteUser(email) {
  if (!email) {
    console.log("❌ 请指定邮箱，例如: node scripts/verify_workflow.js demote test@example.com");
    return;
  }
  const user = await prisma.user.update({
    where: { email },
    data: { role: "USER" },
  });
  console.log(`\n\x1b[33m✅ 降权成功！用户 [${user.email}] 已变更为 USER 普通用户。\x1b[0m\n`);
}

// 降权用户为访客
async function demoteToGuestUser(email) {
  if (!email) {
    console.log("❌ 请指定邮箱，例如: node scripts/verify_workflow.js demote-to-guest test@example.com");
    return;
  }
  const user = await prisma.user.update({
    where: { email },
    data: { role: "GUEST" },
  });
  console.log(`\n\x1b[33m✅ 降权成功！用户 [${user.email}] 已变更为 GUEST 访客用户。\x1b[0m\n`);
}

main();
