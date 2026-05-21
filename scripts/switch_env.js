const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const targetEnv = args[0];

if (!targetEnv || (targetEnv !== "dev" && targetEnv !== "prod")) {
  console.log(`
⚙️  SunnyStation 环境智能切换器
---------------------------------------------
可用命令:
  node scripts/switch_env.js dev  - 切换到本地开发测试库 (Development)
  node scripts/switch_env.js prod - 切换到线上正式生产库 (Production)
`);
  process.exit(0);
}

// 极其巧妙的防 Next.js 劫持设计：
// 我们将原始配置模板命名为 .backup 后缀，防止根目录下存在 .env.development 被 Next.js 开发服务高优先级强制加载覆盖。
const prodEnvPath = path.join(__dirname, "../.env.production.backup");
const devEnvPath = path.join(__dirname, "../.env.development.backup");

// 首次运行时，自动将已有的老模板文件安全转换为无干扰的 .backup 备份
const oldProdPath = path.join(__dirname, "../.env.production");
const oldDevPath = path.join(__dirname, "../.env.development");

try {
  if (fs.existsSync(oldProdPath)) {
    fs.renameSync(oldProdPath, prodEnvPath);
    console.log("📝 已将老配置文件转换为防劫持备份: .env.production -> .env.production.backup");
  }
  if (fs.existsSync(oldDevPath)) {
    fs.renameSync(oldDevPath, devEnvPath);
    console.log("📝 已将老配置文件转换为防劫持备份: .env.development -> .env.development.backup");
  }
} catch (e) {
  console.error("⚠️ 转换配置文件备份时出错，但将尝试继续:", e.message);
}

const activeEnvPath = path.join(__dirname, "../.env");

try {
  if (targetEnv === "dev") {
    if (!fs.existsSync(devEnvPath)) {
      console.error("❌ 找不到开发配置模板 (.env.development.backup)！");
      process.exit(1);
    }
    fs.copyFileSync(devEnvPath, activeEnvPath);
    console.log("\n\x1b[32m✅ 环境切换成功！当前已接入【测试数据库】(Development)\x1b[0m");
    console.log("   💡 此时在本地可畅快执行 seed 注入、模拟中奖和任何破坏性测试，绝对安全。\n");
  } else {
    if (!fs.existsSync(prodEnvPath)) {
      console.error("❌ 找不到正式配置模板 (.env.production.backup)！");
      process.exit(1);
    }
    fs.copyFileSync(prodEnvPath, activeEnvPath);
    console.log("\n\x1b[31m⚠️ 【高能预警】环境切换成功！当前已成功接入【正式生产数据库】(Production) ⚠️\x1b[0m");
    console.log("\x1b[33m   🔥 敬畏数据！此时在本地进行的任何操作（包括对奖、抓取等）都将直连真实数据！\x1b[0m");
    console.log("\x1b[31m   ❌ 绝不允许在此状态下运行 seed 数据注入命令！安全防线已启动拦截。\x1b[0m\n");
  }
} catch (error) {
  console.error("❌ 切换环境失败:", error.message);
}
