export interface ExchangeRateResponse {
  success?: boolean
  timestamp?: number
  base?: string
  date?: string
  rates: Record<string, number>
}

export interface CurrencyConversion {
  from: string
  to: string
  amount: number
  rate: number
  convertedAmount: number
  timestamp: number
  date: string
  fallback?: boolean
  warning?: string
}

interface CachedRateEntry {
  rate: number
  timestamp: number
}

const CACHE_DURATION_MS = 10 * 60 * 1000
const rateCache = new Map<string, CachedRateEntry>()

function cacheKey(from: string, to: string): string {
  return `${from}->${to}`
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0]
}

export function getCachedRate(from: string, to: string): number | null {
  const entry = rateCache.get(cacheKey(from, to))
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
    rateCache.delete(cacheKey(from, to))
    return null
  }
  return entry.rate
}

export function setCachedRate(from: string, to: string, rate: number): void {
  rateCache.set(cacheKey(from, to), {
    rate,
    timestamp: Date.now(),
  })
}

export function buildConversion(from: string, to: string, amount: number, rate: number, options?: { fallback?: boolean; warning?: string; timestamp?: number; date?: string }): CurrencyConversion {
  return {
    from,
    to,
    amount,
    rate,
    convertedAmount: amount * rate,
    timestamp: options?.timestamp ?? Date.now(),
    date: options?.date ?? todayIsoDate(),
    fallback: options?.fallback,
    warning: options?.warning,
  }
}

export async function convertCurrency(amount: number, from: string = "BRL", to: string = "USD"): Promise<CurrencyConversion> {
  const response = await fetch(`/api/currency/convert?from=${from}&to=${to}&amount=${amount}`)

  if (!response.ok) {
    throw new Error("Currency conversion failed")
  }

  const conversion: CurrencyConversion = await response.json()
  if (!conversion.fallback) {
    setCachedRate(from, to, conversion.rate)
  }

  return conversion
}

export async function getBRLToUSDRate(): Promise<number> {
  const conversion = await convertCurrency(1, "BRL", "USD")
  return conversion.rate
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const locale = currency === "BRL" ? "pt-BR" : "en-US"

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyWithConversion(
  amount: number,
  originalCurrency: string,
  convertedAmount?: number,
  targetCurrency: string = "USD",
): string {
  const original = formatCurrency(amount, originalCurrency)

  if (convertedAmount !== undefined && originalCurrency !== targetCurrency) {
    const converted = formatCurrency(convertedAmount, targetCurrency)
    return `${original} (≈ ${converted})`
  }

  return original
}
