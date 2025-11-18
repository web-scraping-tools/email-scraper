import { Browser } from '../types/browser';

/**
 * Helper to dynamically import optional peer dependencies
 */
async function tryImportPlaywright(): Promise<any> {
  try {
    // @ts-ignore - Playwright is an optional peer dependency
    return await import('playwright');
  } catch {
    return null;
  }
}

async function tryImportPuppeteer(): Promise<any> {
  try {
    // @ts-ignore - Puppeteer is an optional peer dependency
    return await import('puppeteer');
  } catch {
    return null;
  }
}

/**
 * Creates a browser instance using Playwright or Puppeteer (whichever is available)
 * Prefers Playwright if both are installed
 */
export async function createBrowser(): Promise<Browser> {
  // Try Playwright first
  const playwright = await tryImportPlaywright();
  if (playwright) {
    try {
      const browser = await playwright.chromium.launch();
      return browser as unknown as Browser;
    } catch (error) {
      // Playwright is installed but failed to launch
      throw new Error(
        `Failed to launch Playwright browser: ${error instanceof Error ? error.message : String(error)}\n` +
        'Make sure Playwright browsers are installed: npx playwright install chromium'
      );
    }
  }

  // Try Puppeteer
  const puppeteer = await tryImportPuppeteer();
  if (puppeteer) {
    try {
      const browser = await puppeteer.launch();
      return browser as unknown as Browser;
    } catch (error) {
      // Puppeteer is installed but failed to launch
      throw new Error(
        `Failed to launch Puppeteer browser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Neither library is installed
  throw new Error(
    'No browser library found. Please install either playwright or puppeteer:\n' +
    '  npm install playwright\n' +
    '  or\n' +
    '  npm install puppeteer'
  );
}

