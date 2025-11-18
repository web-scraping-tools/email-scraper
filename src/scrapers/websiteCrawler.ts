import { Browser, Page } from '../types/browser';
import { scrapeEmailsFromPage } from './webpageScraper';
import { extractAndNormalizeEmails } from '../utils/emailExtractor';

/**
 * Options for website crawling
 */
export interface WebsiteCrawlerOptions {
  maxDepth?: number;
  maxPages?: number;
  sameDomainOnly?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
  useBrowser?: boolean;
  browser?: Browser;
  onPageVisited?: (url: string, depth: number, emailCount: number) => void;
  onError?: (url: string, error: Error) => void;
}

/**
 * Extracts the domain from a URL
 */
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Normalizes a URL (resolves relative URLs, removes fragments)
 */
function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(url, base);
    resolved.hash = ''; // Remove fragments
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Extracts links from HTML content
 */
function extractLinks(html: string, baseUrl: string): Set<string> {
  const links = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const normalized = normalizeUrl(match[1], baseUrl);
    if (normalized) {
      links.add(normalized);
    }
  }

  return links;
}

/**
 * Crawls a website and scrapes emails from all pages
 */
export async function scrapeEmailsFromWebsite(
  startUrl: string,
  options: WebsiteCrawlerOptions = {}
): Promise<Set<string>> {
  const {
    maxDepth = 3,
    maxPages = 50,
    sameDomainOnly = true,
    waitUntil = 'load',
    timeout = 30000,
    useBrowser = false,
    browser,
    onPageVisited,
    onError,
  } = options;

  const allEmails = new Set<string>();
  const visited = new Set<string>();
  const toVisit: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  const startDomain = getDomain(startUrl);

  while (toVisit.length > 0 && visited.size < maxPages) {
    const { url, depth } = toVisit.shift()!;

    if (visited.has(url)) {
      continue;
    }

    if (depth > maxDepth) {
      continue;
    }

    // Check domain restriction
    if (sameDomainOnly && getDomain(url) !== startDomain) {
      continue;
    }

    visited.add(url);

    try {
      let emails: Set<string>;
      let html: string;

      if (useBrowser && browser) {
        const page = await browser.newPage();
        try {
          await page.goto(url, { waitUntil, timeout });
          html = await page.content();
          emails = await scrapeEmailsFromPage(page, url, { waitUntil, timeout });
        } finally {
          await page.close();
        }
      } else {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        html = await response.text();
        emails = extractAndNormalizeEmails(html);
      }

      // Merge emails
      emails.forEach((email) => allEmails.add(email));

      // Notify about page visit
      if (onPageVisited) {
        onPageVisited(url, depth, emails.size);
      }

      // Extract links for next depth level
      if (depth < maxDepth) {
        const links = extractLinks(html, url);
        links.forEach((link) => {
          if (!visited.has(link) && (!sameDomainOnly || getDomain(link) === startDomain)) {
            toVisit.push({ url: link, depth: depth + 1 });
          }
        });
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(url, errorObj);
      } else {
        console.error(`Error scraping ${url}:`, errorObj.message);
      }
      // Continue with other URLs
    }
  }

  return allEmails;
}

