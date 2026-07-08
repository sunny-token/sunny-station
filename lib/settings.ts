import prismaService from "./prismaService";

export interface SystemSettings {
  enableFortunePrize: boolean;
}

const defaultSettings: SystemSettings = {
  enableFortunePrize: true,
};

export async function getSettings(): Promise<SystemSettings> {
  try {
    const prisma = prismaService.getPrismaClient();
    const config = await prisma.systemConfig.findUnique({
      where: { key: "system_settings" },
    });
    if (!config) {
      // 数据库没有配置时，初始化默认配置到数据库中
      await prisma.systemConfig.upsert({
        where: { key: "system_settings" },
        create: {
          key: "system_settings",
          value: JSON.stringify(defaultSettings),
        },
        update: {},
      });
      return defaultSettings;
    }
    return { ...defaultSettings, ...JSON.parse(config.value) };
  } catch (error) {
    console.error("Failed to read settings from DB, using default settings:", error);
    return defaultSettings;
  }
}

export async function updateSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
  try {
    const prisma = prismaService.getPrismaClient();
    const current = await getSettings();
    const updated = { ...current, ...newSettings };
    await prisma.systemConfig.upsert({
      where: { key: "system_settings" },
      create: {
        key: "system_settings",
        value: JSON.stringify(updated),
      },
      update: {
        value: JSON.stringify(updated),
      },
    });
    return updated;
  } catch (error) {
    console.error("Failed to update settings in DB:", error);
    throw new Error("更新设置失败");
  }
}
