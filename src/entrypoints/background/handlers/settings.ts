import { settingsMigratorSingleton } from "../services/settings-migrator";
import type { Settings } from "@/types";

export class SettingsHandler {
  async getSettings(): Promise<Settings> {
    return await settingsMigratorSingleton.getSettings();
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    return await settingsMigratorSingleton.updateSettings(updates);
  }
}
