import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionPath = path.join(__dirname, "..", "..", ".output", "chrome-mv3");

async function checkExtensionExists(): Promise<{ exists: boolean; error?: string }> {
  try {
    await fs.promises.access(extensionPath);
  } catch {
    return { exists: false, error: `Extension directory not found at ${extensionPath}` };
  }

  const manifestPath = path.join(extensionPath, "manifest.json");
  try {
    await fs.promises.access(manifestPath);
  } catch {
    return {
      exists: false,
      error: `manifest.json not found at ${manifestPath}. Build may be incomplete.`,
    };
  }

  try {
    const stats = await fs.promises.stat(extensionPath);
    if (!stats.isDirectory()) {
      return { exists: false, error: `${extensionPath} is not a directory` };
    }
  } catch {
    return { exists: false, error: `Failed to stat ${extensionPath}` };
  }

  return { exists: true };
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: [
    async (_deps, use) => {
      const checkResult = await checkExtensionExists();
      if (!checkResult.exists) {
        throw new Error(`${checkResult.error}. Please run 'pnpm build' first.`);
      }

      const userDataDir = path.join(
        os.tmpdir(),
        `playwright-extension-${Date.now()}-${randomUUID()}`
      );
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      });
      await use(context);
      await context.close();
    },
    { scope: "test" },
  ],
  extensionId: [
    async ({ context }, use) => {
      let [serviceWorker] = context.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent("serviceworker");
      }
      const extensionId = serviceWorker.url().split("/")[2];
      await use(extensionId);
    },
    { scope: "test" },
  ],
});

export const expect = test.expect;
export type { Page };
