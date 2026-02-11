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

let cachedRate: { rate: number; timestamp: number } | null = null
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

export async function convertCurrency(
  amount: number,
  from: string = "BRL",
  to: string = "USD"
): Promise<CurrencyConversion> {
  try {
    const response = await fetch(
      `/api/currency/convert?from=${from}&to=${to}&amount=${amount}`
    )

    if (!response.ok) {
      throw new Error("Currency conversion failed")
    }

    const conversion = await response.json()
    
    if (!conversion.fallback) {
      cachedRate = {
        rate: conversion.rate,
        timestamp: Date.now()
      }
    }

    return conversion
  } catch (error) {
    console.error("Currency conversion error:", error)
    
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
      return {
        from,
        to,
        amount,
        rate: cachedRate.rate,
        convertedAmount: amount * cachedRate.rate,
        timestamp: cachedRate.timestamp,
        date: new Date().toISOString().split('T')[0],
        fallback: true,
        warning: "Using cached exchange rate"
      }
    }

    const fallbackRate = 0.20 // 
    return {
      from,
      to,
      amount,
      rate: fallbackRate,
      convertedAmount: amount * fallbackRate,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      fallback: true,
      warning: "Using approximate exchange rate"
    }
  }
}

export async function getBRLToUSDRate(): Promise<number> {
  try {
    const conversion = await convertCurrency(1, "BRL", "USD")
    return conversion.rate
  } catch (error) {
    console.error("Error getting BRL to USD rate:", error)
    return 0.20 // 
  }
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const locale = currency === "BRL" ? "pt-BR" : "en-US"
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyWithConversion(
  amount: number,
  originalCurrency: string,
  convertedAmount?: number,
  targetCurrency: string = "USD"
): string {
  const original = formatCurrency(amount, originalCurrency)
  
  if (convertedAmount !== undefined && originalCurrency !== targetCurrency) {
    const converted = formatCurrency(convertedAmount, targetCurrency)
    return `${original} (≈ ${converted})`
  }
  
  return original
}
