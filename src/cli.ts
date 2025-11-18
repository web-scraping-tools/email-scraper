#!/usr/bin/env node

import { Command } from 'commander';
import { scrapeEmailsFromUrl, scrapeEmailsFromWebsite, scrapeEmailsFromPage } from './index';
import { createBrowser } from './utils/browserFactory';

const program = new Command();

program
  .name('email-scraper')
  .description('A CLI tool for scraping emails from webpages and websites')
  .version('1.0.0');

program
  .command('page')
  .description('Scrape emails from a single webpage')
  .argument('<url>', 'URL of the webpage to scrape')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '10000')
  .option('-b, --browser', 'Use headless browser (Playwright/Puppeteer) instead of HTTP requests', false)
  .option('--wait-until <event>', 'Wait until event (load, domcontentloaded, networkidle)', 'load')
  .action(async (url: string, options: { timeout: string; browser: boolean; waitUntil: string }) => {
    try {
      console.log(`\n🚀 Scraping emails from: ${url}`);
      console.log(`   Method: ${options.browser ? 'Headless browser' : 'HTTP requests'}`);
      if (options.browser) {
        console.log(`   Wait until: ${options.waitUntil}`);
      }
      console.log(`   Timeout: ${options.timeout}ms\n`);
      
      let emails: Set<string>;
      
      if (options.browser) {
        console.log('   Initializing headless browser...');
        const browser = await createBrowser();
        console.log('   ✓ Browser ready');
        try {
          console.log(`   📄 Loading page: ${url}...`);
          const page = await browser.newPage();
          emails = await scrapeEmailsFromPage(page, url, {
            timeout: parseInt(options.timeout, 10),
            waitUntil: options.waitUntil as 'load' | 'domcontentloaded' | 'networkidle',
          });
          await page.close();
          console.log('   ✓ Page loaded and scraped');
        } finally {
          console.log('   Closing browser...');
          await browser.close();
        }
      } else {
        console.log(`   📄 Fetching: ${url}...`);
        emails = await scrapeEmailsFromUrl(url, {
          timeout: parseInt(options.timeout, 10),
        });
        console.log('   ✓ Page fetched and scraped');
      }

      console.log(`\n📊 Results:`);
      if (emails.size === 0) {
        console.log('   No emails found.');
      } else {
        console.log(`   Found ${emails.size} unique email(s):\n`);
        Array.from(emails).sort().forEach((email) => console.log(`     ${email}`));
      }
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('website')
  .description('Scrape emails from an entire website (crawls from homepage)')
  .argument('<url>', 'URL of the website homepage to start crawling from')
  .option('-d, --max-depth <number>', 'Maximum crawl depth', '3')
  .option('-p, --max-pages <number>', 'Maximum number of pages to crawl', '50')
  .option('--cross-domain', 'Allow crawling to different domains', false)
  .option('-b, --browser', 'Use headless browser (Playwright/Puppeteer) instead of HTTP requests', false)
  .option('--wait-until <event>', 'Wait until event (load, domcontentloaded, networkidle)', 'load')
  .action(async (url: string, options: { maxDepth: string; maxPages: string; crossDomain: boolean; browser: boolean; waitUntil: string }) => {
    try {
      console.log(`\n🚀 Starting website crawl from: ${url}`);
      console.log(`   Max depth: ${options.maxDepth} | Max pages: ${options.maxPages} | Cross-domain: ${options.crossDomain ? 'Yes' : 'No'}`);
      console.log(`   Method: ${options.browser ? 'Headless browser' : 'HTTP requests'}\n`);
      
      let browser: import('./types/browser').Browser | undefined;
      
      if (options.browser) {
        console.log('   Initializing headless browser...');
        browser = await createBrowser();
        console.log('   ✓ Browser ready\n');
      }
      
      let pagesVisited = 0;
      let errors = 0;
      
      try {
        const emails = await scrapeEmailsFromWebsite(url, {
          maxDepth: parseInt(options.maxDepth, 10),
          maxPages: parseInt(options.maxPages, 10),
          sameDomainOnly: !options.crossDomain,
          useBrowser: options.browser,
          browser,
          waitUntil: options.waitUntil as 'load' | 'domcontentloaded' | 'networkidle',
          onPageVisited: (visitedUrl, depth, emailCount) => {
            pagesVisited++;
            const indent = '  '.repeat(depth);
            const emailInfo = emailCount > 0 ? ` (${emailCount} email${emailCount !== 1 ? 's' : ''})` : '';
            console.log(`${indent}📄 [${pagesVisited}/${parseInt(options.maxPages, 10)}] Depth ${depth}: ${visitedUrl}${emailInfo}`);
          },
          onError: (errorUrl, error) => {
            errors++;
            console.error(`   ❌ Error on ${errorUrl}: ${error.message}`);
          },
        });

        console.log(`\n📊 Crawl Summary:`);
        console.log(`   Pages visited: ${pagesVisited}`);
        console.log(`   Errors: ${errors}`);
        console.log(`   Total unique emails found: ${emails.size}\n`);

        if (emails.size === 0) {
          console.log('   No emails found.');
        } else {
          console.log(`   Found ${emails.size} unique email(s):\n`);
          Array.from(emails).sort().forEach((email) => console.log(`     ${email}`));
        }
      } finally {
        if (browser) {
          console.log('\n   Closing browser...');
          await browser.close();
        }
      }
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

