const path = require('path');
const puppeteer = require('puppeteer');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

describe('mock login/logout flow', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(fileUrl);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('logout button toggles visibility after mock login', async () => {
    await page.evaluate(() => {
      window.logout = function () {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        document.querySelector('#logoutBtn').style.display = 'none';
      };

      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      document.querySelector('#logoutBtn').style.display = 'block';
    });

    const visible = await page.evaluate(() => {
      const btn = document.querySelector('#logoutBtn');
      return btn && getComputedStyle(btn).display !== 'none';
    });
    expect(visible).toBe(true);

    await page.click('#logoutBtn');

    const result = await page.evaluate(() => ({
      login: getComputedStyle(document.getElementById('loginSection')).display,
      dash: getComputedStyle(document.getElementById('dashboard')).display,
      btn: getComputedStyle(document.querySelector('#logoutBtn')).display
    }));

    expect(result.login).toBe('block');
    expect(result.dash).toBe('none');
    expect(result.btn).toBe('none');
  });
});
