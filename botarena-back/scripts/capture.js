const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the dashboard (or chat if it redirects)
    await page.goto('http://localhost:3000/dashboard.html');
    
    // Wait for the settings button to be visible and click it
    await page.waitForSelector('#open-settings-btn');
    await page.click('#open-settings-btn');
    
    // Wait for the settings modal and specifically the Pix section to be visible
    await page.waitForSelector('.settings-form__section');
    
    // Take a screenshot of the settings modal
    const modal = await page.locator('#settings-modal');
    await modal.screenshot({ path: '../../artifacts/pix_section_redesign.png' });
    
    await browser.close();
    console.log('Screenshot saved to artifacts/pix_section_redesign.png');
})();
