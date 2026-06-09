@echo off
echo Installing Playwright 1.57.0 (compatible with MCP)...
npm install --save-dev playwright@1.57.0 @playwright/test@1.57.0
npx playwright install chromium
echo Done!
