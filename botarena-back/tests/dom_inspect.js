const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/chat.html');
  await page.waitForTimeout(1000);
  
  const layoutMetrics = await page.evaluate(() => {
    const body = document.querySelector('body');
    const layout = document.querySelector('.chat-layout');
    const sidebar = document.querySelector('.chat-sidebar');
    const main = document.querySelector('.chat-main');
    
    return {
      windowHeight: window.innerHeight,
      bodyClasses: body.className,
      bodyHeight: body.clientHeight,
      bodyComputedBg: window.getComputedStyle(body).backgroundColor,
      layoutHeight: layout ? layout.clientHeight : 'null',
      layoutComputedHeight: layout ? window.getComputedStyle(layout).height : 'null',
      layoutFlex: layout ? window.getComputedStyle(layout).flex : 'null',
      sidebarHeight: sidebar ? sidebar.clientHeight : 'null',
      mainHeight: main ? main.clientHeight : 'null'
    };
  });
  
  console.log(JSON.stringify(layoutMetrics, null, 2));
  await browser.close();
})();
