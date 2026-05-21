const puppeteer = require('puppeteer-core');
(async () => {
    try {
        console.log('Attempting to launch browser...');
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        console.log('Browser launched successfully!');
        const version = await browser.version();
        console.log('Browser version:', version);
        await browser.close();
        console.log('Browser closed.');
    } catch (err) {
        console.error('Launch failed:', err);
    }
})();
