declare module "playwright-extra" {
  import { chromium, firefox, webkit, BrowserType } from "playwright";
  const playwrightExtra: {
    chromium: BrowserType;
    firefox: BrowserType;
    webkit: BrowserType;
    use(plugin: any): void;
  };
  export default playwrightExtra;
}

declare module "playwright-extra-plugin-stealth" {
  const StealthPlugin: () => any;
  export default StealthPlugin;
}
