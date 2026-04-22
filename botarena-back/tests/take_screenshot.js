const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/chat.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'qa-evidence/gigantic_bug.png' });
  await browser.close();
  console.log('Screenshot saved to qa-evidence/gigantic_bug.png');
})();
