#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const puppeteer = require('puppeteer');

class RealBrowserTestServer {
  constructor() {
    this.server = new Server(
      {
        name: 'real-browser-test',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.browser = null;
    this.page = null;
    
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'open_real_site',
          description: 'Open the real localhost:3000 site',
          inputSchema: {
            type: 'object',
            properties: {
              headless: {
                type: 'boolean',
                description: 'Run browser in headless mode',
                default: false
              }
            }
          }
        },
        {
          name: 'go_to_page',
          description: 'Navigate to a page on localhost:3000',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Page path (e.g., /login, /partner/login, /partner/dashboard)',
                default: '/'
              }
            }
          }
        },
        {
          name: 'test_partner_login',
          description: 'Test the real partner login flow on localhost:3000',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email to login with',
                default: 'partner@diamante.com'
              },
              password: {
                type: 'string',
                description: 'Password to login with',
                default: 'password123'
              }
            }
          }
        },
        {
          name: 'get_current_state',
          description: 'Get current page URL and title from real site',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'check_localStorage',
          description: 'Check localStorage on real site',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'take_screenshot',
          description: 'Take screenshot of current real page',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Screenshot filename',
                default: 'current-page.png'
              }
            }
          }
        },
        {
          name: 'close_browser',
          description: 'Close the real browser',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;
        
        switch (name) {
          case 'open_real_site':
            result = await this.openRealSite(args || {});
            break;
          case 'go_to_page':
            result = await this.goToPage(args || {});
            break;
          case 'test_partner_login':
            result = await this.testPartnerLogin(args || {});
            break;
          case 'get_current_state':
            result = await this.getCurrentState();
            break;
          case 'check_localStorage':
            result = await this.checkLocalStorage();
            break;
          case 'take_screenshot':
            result = await this.takeScreenshot(args || {});
            break;
          case 'close_browser':
            result = await this.closeBrowser();
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: result
            }
          ]
        };
        
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async openRealSite(args) {
    const { headless = false } = args;
    
    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = await puppeteer.launch({
      headless,
      defaultViewport: { width: 1200, height: 800 }
    });
    
    this.page = await this.browser.newPage();
    
    // Log console from real site
    this.page.on('console', msg => {
      console.log(`🔥 Real Site Console [${msg.type()}]:`, msg.text());
    });
    
    // Go to real site homepage
    await this.page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    return `Browser opened and connected to REAL localhost:3000 site (headless: ${headless})`;
  }

  async goToPage(args) {
    if (!this.page) throw new Error('Browser not opened. Use open_real_site first.');
    
    const { path = '/' } = args;
    const url = `http://localhost:3000${path}`;
    
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    
    const title = await this.page.title();
    const currentUrl = this.page.url();
    
    return `Navigated to REAL site: ${currentUrl}\nPage title: ${title}`;
  }

  async testPartnerLogin(args) {
    if (!this.page) throw new Error('Browser not opened. Use open_real_site first.');
    
    const { email = 'partner@diamante.com', password = 'password123' } = args;
    
    // Go to real partner login page
    await this.page.goto('http://localhost:3000/partner/login', { waitUntil: 'networkidle2' });
    
    // Wait for real form elements
    await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await this.page.waitForSelector('input[type="password"]', { timeout: 5000 });
    
    // Fill real form
    await this.page.type('input[type="email"]', email);
    await this.page.type('input[type="password"]', password);
    
    // Click real submit button
    const navigationPromise = this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await this.page.click('button[type="submit"]');
    
    await navigationPromise;
    
    const finalUrl = this.page.url();
    const title = await this.page.title();
    
    let result = `REAL PARTNER LOGIN TEST:\n`;
    result += `- Credentials: ${email}\n`;
    result += `- Final URL: ${finalUrl}\n`;
    result += `- Page Title: ${title}\n`;
    
    if (finalUrl.includes('/partner/dashboard')) {
      // Check real localStorage
      const storage = await this.page.evaluate(() => {
        return {
          hasPartnerToken: !!localStorage.getItem('partnerToken'),
          hasPartnerEmployee: !!localStorage.getItem('partnerEmployee'),
          hasPartnerCompany: !!localStorage.getItem('partnerCompany')
        };
      });
      
      result += `- LOGIN SUCCESS: Redirected to dashboard\n`;
      result += `- Real localStorage: ${JSON.stringify(storage)}`;
    } else {
      result += `- LOGIN FAILED: Did not reach dashboard`;
    }
    
    return result;
  }

  async getCurrentState() {
    if (!this.page) throw new Error('Browser not opened. Use open_real_site first.');
    
    const url = this.page.url();
    const title = await this.page.title();
    
    return `REAL SITE STATE:\n- URL: ${url}\n- Title: ${title}`;
  }

  async checkLocalStorage() {
    if (!this.page) throw new Error('Browser not opened. Use open_real_site first.');
    
    const storage = await this.page.evaluate(() => {
      const all = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        all[key] = localStorage.getItem(key);
      }
      return all;
    });
    
    return `REAL SITE localStorage:\n${JSON.stringify(storage, null, 2)}`;
  }

  async takeScreenshot(args) {
    if (!this.page) throw new Error('Browser not opened. Use open_real_site first.');
    
    const { name = 'current-page.png' } = args;
    await this.page.screenshot({ path: name, fullPage: true });
    
    return `Screenshot of REAL site saved as: ${name}`;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    
    return 'Real browser closed';
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Real Browser Test MCP Server running on stdio');
  }
}

const server = new RealBrowserTestServer();
server.run().catch(console.error);