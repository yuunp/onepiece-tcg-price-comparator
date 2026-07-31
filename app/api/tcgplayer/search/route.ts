import { type NextRequest, NextResponse } from "next/server"

interface Product {
  productId: number
  name: string
  cleanName: string
  imageUrl: string
  categoryId: number
  groupId: number
  url: string
  modifiedOn: string
  extendedData?: Array<{
    name: string
    displayName: string
    value: string
  }>
  setName?: string
  setCode?: string
  groupName?: string
  price?: MarketPrice
}

interface MarketPrice {
  productId: number
  lowPrice: number
  midPrice: number
  highPrice: number
  marketPrice: number
  directLowPrice: number
  subTypeName: string
}

interface TCGGroup {
  groupId: number
  name: string
  abbreviation?: string
}

const ONE_PIECE_CATEGORY_ID = 68
const REQUEST_HEADERS = {
  "User-Agent": "BountyDex/1.0 (+https://bountydex.yunp.fun)",
  Accept: "application/json",
}
const MAX_RESULTS = 100
const SEARCHABLE_GROUP_LIMIT = 100
const GROUP_PRIORITY_KEYWORDS = ["starter deck", "promo", "premium booster", "extra booster", "release event", "anniversary", "ultra deck"]

function buildSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
}

function scoreGroup(group: TCGGroup, query: string): number {
  const name = group.name.toLowerCase()
  const queryLower = query.toLowerCase()
  let score = 0

  if (name.includes(queryLower)) score += 50
  for (const keyword of GROUP_PRIORITY_KEYWORDS) {
    if (name.includes(keyword)) score += 10
  }

  return score
}

function matchesProduct(product: Product, query: string, searchTerms: string[]): boolean {
  const productName = product.name.toLowerCase()
  const cleanName = product.cleanName.toLowerCase()
  if (productName.includes(query) || cleanName.includes(query)) return true
  return searchTerms.some((term) => productName.includes(term) || cleanName.includes(term))
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`)
  }

  return response.json()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")?.trim()

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  try {
    const groupsData = await fetchJson<{ results?: TCGGroup[] } | TCGGroup[]>(`https://tcgcsv.com/tcgplayer/${ONE_PIECE_CATEGORY_ID}/groups`)
    const groups = Array.isArray(groupsData) ? groupsData : groupsData.results || []
    const rankedGroups = groups
      .map((group) => ({ group, score: scoreGroup(group, query) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, SEARCHABLE_GROUP_LIMIT)
      .map(({ group }) => group)

    const normalizedQuery = query.toLowerCase()
    const searchTerms = buildSearchTerms(query)

    const allResults = await Promise.all(
      rankedGroups.map(async (group) => {
        try {
          const productsData = await fetchJson<{ results?: Product[] } | Product[]>(
            `https://tcgcsv.com/tcgplayer/${ONE_PIECE_CATEGORY_ID}/${group.groupId}/products`,
          )
          const products = Array.isArray(productsData) ? productsData : productsData.results || []
          const matchingProducts = products.filter((product) => matchesProduct(product, normalizedQuery, searchTerms))

          if (matchingProducts.length === 0) {
            return []
          }

          const pricesData = await fetchJson<{ results?: MarketPrice[] } | MarketPrice[]>(
            `https://tcgcsv.com/tcgplayer/${ONE_PIECE_CATEGORY_ID}/${group.groupId}/prices`,
          ).catch(() => [])

          const prices = Array.isArray(pricesData) ? pricesData : pricesData.results || []

          return matchingProducts.map((product) => {
            const price = prices.find((entry) => entry.productId === product.productId)
            const setCode = extractSetCodeFromExtendedData(product.extendedData)

            return {
              ...product,
              groupName: group.name,
              setName: group.name,
              setCode: setCode || group.abbreviation || extractSetCodeFromSetName(group.name),
              price,
            }
          })
        } catch (error) {
          console.error(`TCG group search failed for ${group.groupId}:`, error)
          return []
        }
      }),
    )

    const flatResults = allResults
      .flat()
      .sort((left, right) => {
        const leftPrice = left.price?.marketPrice ?? Number.POSITIVE_INFINITY
        const rightPrice = right.price?.marketPrice ?? Number.POSITIVE_INFINITY
        return leftPrice - rightPrice
      })

    return NextResponse.json({
      query,
      categoryId: ONE_PIECE_CATEGORY_ID,
      results: flatResults.slice(0, MAX_RESULTS),
      totalFound: flatResults.length,
      searchedGroups: rankedGroups.length,
    })
  } catch (error) {
    console.error("TCG search route error:", error)
    return NextResponse.json(
      {
        error: "Failed to search TCGPlayer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function extractSetCodeFromExtendedData(extendedData?: Array<{ name: string; value: string }>): string | null {
  if (!extendedData) return null

  const numberField = extendedData.find((data) => data.name.toLowerCase() === "number")
  if (!numberField?.value) return null

  const setCodeMatch = numberField.value.match(/^([A-Z0-9]+)-\d+/)
  return setCodeMatch?.[1] || null
}

function extractSetCodeFromSetName(setName: string): string {
  const setMappings: Record<string, string> = {
    "romance dawn": "OP01",
    "paramount war": "OP02",
    "pillars of strength": "OP03",
    "kingdoms of intrigue": "OP04",
    "awakening of the new era": "OP05",
    "wings of the captain": "OP06",
    "500 years in the future": "OP07",
    "two legends": "OP08",
    "starter deck": "ST01",
    memorial: "EB01",
    promotional: "P",
    promo: "P",
    championship: "CH01",
  }

  const lowerSetName = setName.toLowerCase()
  for (const [name, code] of Object.entries(setMappings)) {
    if (lowerSetName.includes(name)) return code
  }

  return "UNK"
}
