const fs = require('fs');
const STATE_FILE = 'auth-state.json';

if (!fs.existsSync(STATE_FILE)) {
    console.error('No auth-state.json found to fix.');
    process.exit(1);
}

try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    const cleanState = {
        cookies: data.cookies || [],
        origins: [] // Strip the massive local storage
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(cleanState, null, 2));

    const sizeKb = (fs.statSync(STATE_FILE).size / 1024).toFixed(2);
    console.log('--- Auth State Shrinker ---');
    console.log(`Success! ${STATE_FILE} has been cleaned.`);
    console.log(`New size: ${sizeKb} KB.`);
    console.log('\nYou can now copy the NEW content of auth-state.json into your GitHub Secret.');
} catch (e) {
    console.error('Error parsing auth-state.json:', e.message);
}
