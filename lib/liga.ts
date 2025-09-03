import { convertCurrency, formatCurrency, formatCurrencyWithConversion } from "./currency"

export interface LigaCard {
  name: string
  price: number
  numericCode: string
  currency: string
  priceUSD?: number // Added USD converted price
  imageUrl?: string
  url: string
  rarity?: string
  set?: string
  condition?: string
}

export interface LigaSearchResponse {
  query: string
  source: string
  results: LigaCard[]
  totalFound: number
  exchangeRate?: number // Added exchange rate info
}

export async function searchLigaOnePiece(query: string): Promise<LigaSearchResponse> {
  const response = await fetch(`/api/liga/search?q=${encodeURIComponent(query)}`)

  if (!response.ok) {
    throw new Error("Failed to search Liga One Piece")
  }

  const data = await response.json()

  if (data.results && data.results.length > 0) {
    try {
      const conversion = await convertCurrency(1, "BRL", "USD")
      const exchangeRate = conversion.rate

      data.results = data.results.map((card: LigaCard) => ({
        ...card,
        priceUSD: card.price > 0 ? card.price * exchangeRate : undefined,
      }))

      data.exchangeRate = exchangeRate
    } catch (error) {
      console.error("Error converting Liga prices to USD:", error)
    }
  }

  return data
}

export function formatBRLPrice(price: number): string {
  return formatCurrency(price, "BRL")
}

export function formatLigaPriceWithUSD(price: number, priceUSD?: number): string {
  return formatCurrencyWithConversion(price, "BRL", priceUSD, "USD")
}
