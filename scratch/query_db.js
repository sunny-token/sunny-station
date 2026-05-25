const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const latestSsq = await prisma.sSQResult.findFirst({
    orderBy: { openDate: "desc" }
  });
  console.log("最新一期双色球:", JSON.stringify(latestSsq, null, 2));
  
  const latestDlt = await prisma.dLTResult.findFirst({
    orderBy: { openDate: "desc" }
  });
  console.log("最新一期大乐透:", JSON.stringify(latestDlt, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
