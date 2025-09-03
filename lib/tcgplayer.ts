export interface TCGPlayerCard {
  productId: number
  name: string
  cleanName: string
  imageUrl: string
  categoryId: number
  groupId: number
  url: string
  price?: {
    productId: number
    lowPrice: number
    midPrice: number
    highPrice: number
    marketPrice: number
    directLowPrice: number
    subTypeName: string
  }
  extendedData?: Array<{
    name: string
    displayName: string
    value: string
  }>
}

export interface TCGPlayerSearchResponse {
  query: string
  categoryId: number
  results: TCGPlayerCard[]
  totalFound: number
}

export async function searchTCGPlayer(query: string): Promise<TCGPlayerSearchResponse> {
  const response = await fetch(`/api/tcgplayer/search?q=${encodeURIComponent(query)}`)

  if (!response.ok) {
    throw new Error("Failed to search TCGPlayer")
  }

  return response.json()
}

export async function getTCGPlayerCategories() {
  const response = await fetch("/api/tcgplayer/categories")

  if (!response.ok) {
    throw new Error("Failed to fetch categories")
  }

  return response.json()
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price)
}
