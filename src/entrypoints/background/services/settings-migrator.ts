import { storage, SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings } from "@/types";
import { classifyError } from "./error-reporting";

const CURRENT_SETTINGS_VERSION = 1;

type MigrationFunction = (settings: Partial<Settings>) => Partial<Settings>;

interface Migration {
  version: number;
  up: MigrationFunction;
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (settings) => {
      return {
        ...settings,
        settingsVersion: 1,
      };
    },
  },
];

export class SettingsMigrator {
  private cachedSettings: Settings | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5000;
  private pendingMigration: Promise<Settings> | null = null;
  private unwatchSettings: (() => void) | null = null;
  private ignoreNextCacheInvalidation: boolean = false;

  async migrateSettings(): Promise<Settings> {
    let existingSnapshot: Partial<Settings> | null = null;

    try {
      const currentSettings = await storage.getItem<Partial<Settings>>(SETTINGS_KEY);
      existingSnapshot = currentSettings ? { ...currentSettings } : null;

      if (!currentSettings) {
        await storage.setItem(SETTINGS_KEY, DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }

      const currentVersion = currentSettings.settingsVersion || 0;

      if (currentVersion >= CURRENT_SETTINGS_VERSION) {
        return { ...DEFAULT_SETTINGS, ...currentSettings } as Settings;
      }

      let migratedSettings = { ...currentSettings };

      for (const migration of migrations) {
        if (migration.version > currentVersion) {
          migratedSettings = migration.up(migratedSettings);
        }
      }

      const finalSettings: Settings = {
        ...DEFAULT_SETTINGS,
        ...migratedSettings,
      };

      await storage.setItem(SETTINGS_KEY, finalSettings);
      console.log(
        `Settings migrated from version ${currentVersion} to ${CURRENT_SETTINGS_VERSION}`
      );

      return finalSettings;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Settings migration failed:", errorMessage);
      classifyError(e, "settings migration");

      if (existingSnapshot && Object.keys(existingSnapshot).length > 0) {
        console.warn("Preserving existing settings due to migration failure");
        return { ...DEFAULT_SETTINGS, ...existingSnapshot } as Settings;
      }

      console.warn("No existing settings available, falling back to defaults");
      return DEFAULT_SETTINGS;
    }
  }

  async getSettings(): Promise<Settings> {
    if (this.cachedSettings && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedSettings;
    }

    if (this.pendingMigration) {
      return this.pendingMigration;
    }

    this.pendingMigration = this.migrateSettings();
    try {
      const settings = await this.pendingMigration;
      this.cachedSettings = settings;
      this.cacheTimestamp = Date.now();
      return settings;
    } finally {
      this.pendingMigration = null;
    }
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const currentSettings = await this.getSettings();
    const newSettings: Settings = {
      ...currentSettings,
      ...updates,
      settingsVersion: CURRENT_SETTINGS_VERSION,
    };
    this.ignoreNextCacheInvalidation = true;
    await storage.setItem(SETTINGS_KEY, newSettings);
    this.cachedSettings = newSettings;
    this.cacheTimestamp = Date.now();
    return newSettings;
  }

  invalidateCache(): void {
    this.cachedSettings = null;
    this.cacheTimestamp = 0;
    this.pendingMigration = null;
  }

  initWatcher(): void {
    if (this.unwatchSettings) return;
    this.unwatchSettings = storage.watch<Settings>(SETTINGS_KEY, () => {
      if (this.ignoreNextCacheInvalidation) {
        this.ignoreNextCacheInvalidation = false;
        return;
      }
      this.invalidateCache();
    });
  }

  disposeWatcher(): void {
    if (this.unwatchSettings) {
      this.unwatchSettings();
      this.unwatchSettings = null;
    }
  }
}

export const settingsMigratorSingleton = new SettingsMigrator();
