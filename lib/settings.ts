import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "lib/settings.json");

export interface SystemSettings {
  enableFortunePrize: boolean;
}

const defaultSettings: SystemSettings = {
  enableFortunePrize: true,
};

export function getSettings(): SystemSettings {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultSettings, null, 2), "utf-8");
      return defaultSettings;
    }
    const data = fs.readFileSync(configPath, "utf-8");
    return { ...defaultSettings, ...JSON.parse(data) };
  } catch (error) {
    console.error("Failed to read settings, using default settings:", error);
    return defaultSettings;
  }
}

export function updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
  try {
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (error) {
    console.error("Failed to update settings:", error);
    throw new Error("更新设置失败");
  }
}
