const { chromium } = require('playwright');
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
require('dotenv').config();

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const STATE_FILE = 'auth-state.json';
const CONFIG_FILE = 'reports.json';

async function processReport(browser, reportConfig) {
    const { name, url, channel } = reportConfig;
    console.log(`\n--- Processing Report: ${name} ---`);

    // Append parameters for a cleaner UI
    const cleanUrl = url.includes('?')
        ? `${url}&chromeless=1&navContentPaneEnabled=false`
        : `${url}?chromeless=1&navContentPaneEnabled=false`;

    // Set a large viewport to capture long reports
    const context = await browser.newContext({
        storageState: STATE_FILE,
        viewport: { width: 1920, height: 1200 } // Initial viewport, will be adjusted dynamically
    });
    const page = await context.newPage();

    console.log(`Navigating to ${name}...`);
    try {
        await page.goto(cleanUrl, { waitUntil: 'load', timeout: 90000 });
        console.log('Page loaded. Waiting 10s for background redirects/refreshes to settle...');
        await page.waitForTimeout(10000);
    } catch (e) {
        console.error(`Failed to navigate to ${name}:`, e.message);
    }

    // Inject CSS to hide UI components and un-constrain height
    console.log('Cleaning up UI elements and unlocking height...');
    await page.addStyleTag({
        content: `
      #left-nav, .left-nav, .nav-pane, .top-nav-bar, .header-bar, .app-header { display: none !important; }
      .report-container { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
      #pvExplorationHost { top: 0 !important; left: 0 !important; height: auto !important; overflow: visible !important; }
      .re-viewport { height: auto !important; overflow: visible !important; }
    `
    });

    // Dynamically determine the height of the report
    const dynamicHeight = await page.evaluate(() => {
        const selectors = [
            '.reportContainer',
            '#pvExplorationHost',
            '.visual-container',
            'iframe'
        ];

        let maxHeight = 0;
        selectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                maxHeight = Math.max(maxHeight, element.scrollHeight);
            }
        });

        // Fallback to various body/html height properties
        const bodyHeight = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );

        // Return the largest found height, but at least 5200 as requested previously if it's a long report
        return Math.max(maxHeight, bodyHeight, 1200);
    });

    // Since detection was under-reporting (2400 instead of the expected length), 
    // Let's use a very safe baseline if the automated detection feels too small.
    const safetyHeight = Math.max(dynamicHeight, 5200);

    console.log(`Detected height: ${dynamicHeight}px. Using Safety Height: ${safetyHeight}px. Adjusting viewport...`);
    await page.setViewportSize({ width: 1920, height: safetyHeight + 200 });

    console.log('Scrolling to force render visuals...');
    await page.evaluate(async (targetHeight) => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 500;
            let timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= targetHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 400);
        });
    }, safetyHeight);

    await page.evaluate(() => window.scrollTo(0, 0));
    console.log('Waiting for stabilization...');
    await page.waitForTimeout(10000);

    const screenshotPath = `report-${name.replace(/\s+/g, '_').toLowerCase()}.png`;
    console.log('Taking screenshot...');
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });

    await context.close();

    console.log(`Uploading ${name} to Slack channel ${channel}...`);
    const slack = new WebClient(SLACK_TOKEN);

    try {
        await slack.files.uploadV2({
            channel_id: channel,
            file: fs.createReadStream(screenshotPath),
            filename: `${name}_Daily_Report.png`,
            initial_comment: `📊 *Daily Power BI Report: ${name}* (${new Date().toLocaleDateString()})\nView online: ${url}`,
        });
        console.log(`Successfully sent ${name} to Slack!`);
    } catch (error) {
        console.error(`Error uploading ${name} to Slack:`, error.data || error.message);
    }
}

async function runAll() {
    const targetReportName = process.argv[2]; // Get report name from CLI: node publish.js "Report Name"

    if (!fs.existsSync(STATE_FILE)) {
        console.error('Error: auth-state.json not found. Please run login.js first.');
        process.exit(1);
    }

    if (!fs.existsSync(CONFIG_FILE)) {
        console.error('Error: reports.json not found.');
        process.exit(1);
    }

    let reports = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    // If a report name is provided, filter the list
    if (targetReportName) {
        reports = reports.filter(r => r.name.toLowerCase() === targetReportName.toLowerCase());
        if (reports.length === 0) {
            console.error(`Error: No report found matching name "${targetReportName}"`);
            process.exit(1);
        }
    }

    const browser = await chromium.launch({ headless: true });

    for (const report of reports) {
        try {
            await processReport(browser, report);
        } catch (err) {
            console.error(`Unexpected error processing ${report.name}:`, err);
        }
    }

    await browser.close();
    console.log('\nAll reports processed!');
}

runAll();
