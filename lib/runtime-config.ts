const DEFAULT_EXCHANGE_RATE = 0.2

export const APP_NAME = "BountyDex"
export const BRL_TO_USD_FALLBACK_RATE = Number.parseFloat(process.env.BRL_TO_USD_FALLBACK_RATE || `${DEFAULT_EXCHANGE_RATE}`)
export const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || ""

export function hasScraperApiKey(): boolean {
  return SCRAPER_API_KEY.trim().length > 0
}
