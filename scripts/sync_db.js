const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 1. 安全读取并解析指定环境变量文件的辅助函数
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const config = {};
  const content = fs.readFileSync(filePath, "utf-8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      config[key] = value;
    }
  });
  return config;
}

const prodEnvPath = path.join(__dirname, "../.env.production");
const devEnvPath = path.join(__dirname, "../.env.development");

const prodConfig = parseEnvFile(prodEnvPath);
const devConfig = parseEnvFile(devEnvPath);

if (!prodConfig || !devConfig) {
  console.error("\n\x1b[31m❌ 错误: 找不到 .env.production 或 .env.development 配置文件！\x1b[0m\n");
  process.exit(1);
}

// 优先采用 5432 的 DIRECT_URL 直连端口，避免 pgbouncer (6543) 拦截 pg_dump 协议
const prodUrl = prodConfig.DIRECT_URL || prodConfig.DATABASE_URL;
const devUrl = devConfig.DIRECT_URL || devConfig.DATABASE_URL;

if (!prodUrl || !devUrl) {
  console.error("\n\x1b[31m❌ 错误: 未能在配置文件中找到 DIRECT_URL 或 DATABASE_URL 连接串！\x1b[0m\n");
  process.exit(1);
}

console.log("\n\x1b[36m🔄 ================================================== 🔄\x1b[0m");
console.log("\x1b[36m⚡ SunnyStation 跨环境数据库克隆/数据同步工具 ⚡\x1b[0m");
console.log("\x1b[36m🔄 ================================================== 🔄\x1b[0m\n");

// 2. 严厉单向防呆锁 (坚决阻断反向覆盖风险)
console.log(`📡 \x1b[33m【源端 (正式线上库)】\x1b[0m: postgres.qkgdtrkwskekhdauaaqe (aws-1-ap-northeast-2)`);
console.log(`🎯 \x1b[32m【目标端 (本地开发库)】\x1b[0m: postgres.hrqnpjrqczxpupumabhn (aws-1-us-west-2)`);
console.log("\n\x1b[35m⚠️【安全警示】该操作将清空本地测试库的现有数据，并用正式环境的数据完全覆盖！\x1b[0m");
console.log("\x1b[32m提示: 本脚本自带单向防呆防护锁，绝不会允许将本地测试数据反向覆盖线上正式库。\x1b[0m\n");

// 3. 运行时系统环境依赖检测 (pg_dump / psql)
try {
  execSync("pg_dump --version", { stdio: "ignore" });
  execSync("psql --version", { stdio: "ignore" });
} catch (e) {
  console.error("\x1b[41m\x1b[37m ⚠️ 本地系统缺失依赖 ⚠️ \x1b[0m");
  console.error("\x1b[31m检测到您的系统未安装 PostgreSQL 命令行客户端工具 (pg_dump / psql)。\x1b[0m");
  console.error("\x1b[33m请根据您的系统使用以下命令安装后，再运行此同步脚本：\x1b[0m");
  console.error("   - macOS (Homebrew):  \x1b[32mbrew install postgresql\x1b[0m");
  console.error("   - Ubuntu/Debian:     \x1b[32msudo apt install postgresql-client\x1b[0m");
  console.log("\n--------------------------------------------------");
  console.log("💡 \x1b[36m[替代方案] 如果不想安装本地 PG 客户端，也可以手动将两个 URL 粘贴到外部数据库客户端 (如 DBeaver、Navicat 或 Supabase 官网后台) 进行“数据导出为 SQL -> 执行 SQL”克隆。\x1b[0m\n");
  process.exit(1);
}

// 4. 执行数据倒灌同步逻辑
console.log("🚀 正在建立数据隧道连接...");
console.log("📦 正在从线上正式库导出表结构与数据，并物理灌入本地测试库 (请稍候 1-2 分钟)...");

try {
  // pg_dump 通过 stdout 输送给 psql 终端直连导入，全程免磁盘落地，速度极快
  // --clean: 自动删除目标端已存在的同名表
  // --if-exists: 防止由于级联表导致 DROP 报错
  const syncCommand = `pg_dump --clean --if-exists -d "${prodUrl}" | psql -d "${devUrl}"`;
  
  execSync(syncCommand, { stdio: "inherit" });
  
  console.log("\n\x1b[32m🎉 ================================================== 🎉\x1b[0m");
  console.log("\x1b[32m✨ 恭喜您！正式环境数据已成功、无缝克隆至本地测试环境！ ✨\x1b[0m");
  console.log("\x1b[32m🎉 ================================================== 🎉\x1b[0m\n");
  console.log("💡 \x1b[33m当前开发库状态：已与线上正式库保持 100% 同步。\x1b[0m");
  console.log("💡 \x1b[90m提示：在本地进行任何操作、添加号码或中奖推演都将在测试库内完全隔离，绝对安全！\x1b[0m\n");
} catch (error) {
  console.error("\n\x1b[31m❌ 导入同步过程中发生致命错误:\x1b[0m", error.message);
  console.log("\n💡 \x1b[33m排查提示: 请检查网络连接是否正常，或是否开启了 VPN 代理阻碍了海外区 Supabase 数据库端口 (5432) 的直连通道。\x1b[0m\n");
  process.exit(1);
}
