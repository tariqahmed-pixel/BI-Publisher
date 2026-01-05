const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

const REPORT_URL = process.env.REPORT_URL || 'https://app.powerbi.com/';
const STATE_FILE = 'auth-state.json';

async function login() {
    console.log('Opening browser for login...');
    const browser = await chromium.launch({ headless: false }); // Show browser
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(REPORT_URL);

    console.log('------------------------------------------------------------');
    console.log('PLEASE LOGIN MANUALLY IN THE OPEN BROWSER WINDOW.');
    console.log('Once you are viewing the report, come back here and press ENTER.');
    console.log('------------------------------------------------------------');

    process.stdin.resume();
    process.stdin.on('data', async () => {
        console.log('Capturing authentication state...');
        const state = await context.storageState();

        // Power BI local storage is huge (500KB+) and mostly unnecessary for auth.
        // We strip it to stay under GitHub Secrets 64KB limit.
        const cleanState = {
            cookies: state.cookies,
            origins: [] // Remove large local storage
        };

        fs.writeFileSync(STATE_FILE, JSON.stringify(cleanState, null, 2));

        const sizeKb = (fs.statSync(STATE_FILE).size / 1024).toFixed(2);
        console.log(`\nSuccess! State saved to ${STATE_FILE}`);
        console.log(`New file size: ${sizeKb} KB (Well within GitHub's 64KB limit).`);

        await browser.close();
        process.exit(0);
    });
}

login();
