# Power BI to Slack Publisher

This tool automates taking screenshots of Power BI reports and posting them to Slack.

## 🚀 GitHub Actions Setup (Recommended)

GitHub Actions allows you to run this entirely in the cloud without keeping your computer on.

### Step 1: Create a GitHub Repository
1. Create a **Private** repository on GitHub.
2. Push all the files from this folder to that repository.
   - *Note: Do NOT push `auth-state.json` or `.env` if you make the repository public.*

### Step 2: Configure Secrets
On GitHub, go to your repository **Settings** > **Secrets and variables** > **Actions** and add these **New repository secrets**:

1. **`SLACK_TOKEN`**: Your Slack Bot User OAuth Token (`xoxb-...`).
2. **`REPORT_URL`**: Your primary Power BI report URL.
3. **`AUTH_STATE_JSON`**: 
   - Open your local `auth-state.json` file.
   - Copy the **entire** content of that file.
   - Paste it into this GitHub Secret.

### Step 3: Configure `reports.json`
Update the `reports.json` file in your repository with the names and channel IDs of all the reports you want to publish.

### Step 4: Scheduling
The schedule is defined in `.github/workflows/publish.yml`. 
- By default, it runs at 10:00 AM UTC. 
- You can change the `cron` line to adjust the time.
- If you want different times for different reports, create separate `.yml` files in that folder and change the `Run Publisher` line to:
  `run: node publish.js "Your Report Name"`

---

## 💻 Local Setup (Alternative)

1. **Install Dependencies**:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure Environment**:
   - Rename `.env.template` to `.env` and fill in your tokens.

3. **Login (One-time)**:
   ```bash
   node login.js
   ```
   - Log in manually and press ENTER in the terminal to save your session.

4. **Run**:
   ```bash
   node publish.js
   ```

## ⏰ Local Scheduling (Windows)
- Use **Task Scheduler** to run `node publish.js` daily at your preferred time.
