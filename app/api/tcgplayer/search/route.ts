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
  publishedOn?: string
  modifiedOn?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  try {
    const onePieceCategoryId = 68

    console.log("[v0] Fetching groups for One Piece category:", onePieceCategoryId)
    const groupsResponse = await fetch(`https://tcgcsv.com/tcgplayer/${onePieceCategoryId}/groups`)

    if (!groupsResponse.ok) {
      throw new Error(`Groups API returned ${groupsResponse.status}`)
    }

    const groupsData = await groupsResponse.json()
    const groups: TCGGroup[] = groupsData.results || groupsData

    if (!Array.isArray(groups)) {
      console.error("[v0] Groups is not an array:", typeof groups, groups)
      throw new Error("Groups response is not an array")
    }

    const searchResults: Array<Product & { price?: MarketPrice }> = []

    const groupPromises = groups.map(async (group) => {
      try {
        console.log(`[v0] 🔍 Searching in: "${group.name}" (ID: ${group.groupId})`)
        const productsResponse = await fetch(
          `https://tcgcsv.com/tcgplayer/${onePieceCategoryId}/${group.groupId}/products`,
        )

        if (!productsResponse.ok) {
          console.warn(`❌ Products API returned ${productsResponse.status} for group ${group.groupId}`)
          return []
        }

        const productsData = await productsResponse.json()
        const products: Product[] = productsData.results || productsData

        const searchTerms = query
          .toLowerCase()
          .split(" ")
          .filter((term) => term.length > 1)
        
        const matchingProducts = products.filter((product) => {
          const productName = product.name.toLowerCase()
          const cleanName = product.cleanName.toLowerCase()

          if (productName.includes(query.toLowerCase()) || cleanName.includes(query.toLowerCase())) {
            return true
          }

          return searchTerms.some((term) => productName.includes(term) || cleanName.includes(term))
        })

        if (matchingProducts.length > 0) {
          console.log(`✅ Found ${matchingProducts.length} matches in "${group.name}"`)
          
          try {
            const pricesResponse = await fetch(
              `https://tcgcsv.com/tcgplayer/${onePieceCategoryId}/${group.groupId}/prices`,
            )

            let prices: MarketPrice[] = []
            if (pricesResponse.ok) {
              const pricesData = await pricesResponse.json()
              prices = pricesData.results || pricesData
            }

            return matchingProducts.map((product) => {
              const price = prices.find((p) => p.productId === product.productId)
              
              // 🎯 EXTRAIR CÓDIGO DO SET DIRETO DO EXTENDEDDATA
              const setCode = extractSetCodeFromExtendedData(product.extendedData)
              
              return { 
                ...product, 
                price,
                setName: group.name,
                setCode: setCode || group.abbreviation || extractSetCodeFromSetName(group.name)
              }
            })
          } catch (priceError) {
            console.error(`❌ Error fetching prices for group ${group.groupId}:`, priceError)
            return matchingProducts.map((product) => {
              const setCode = extractSetCodeFromExtendedData(product.extendedData)
              
              return {
                ...product,
                setName: group.name,
                setCode: setCode || group.abbreviation || extractSetCodeFromSetName(group.name)
              }
            })
          }
        }
        return []
      } catch (groupError) {
        console.error(`❌ Error fetching products for group ${group.groupId}:`, groupError)
        return []
      }
    })

    const allResults = await Promise.all(groupPromises)
    const flatResults = allResults.flat()

    console.log(`[v0] 📊 FINAL RESULTS: ${flatResults.length} total matches`)
    
    // 🔍 DEBUG: Mostrar amostra dos resultados finais
    if (flatResults.length > 0) {
      console.log("[v0] 📋 Sample results with set info:")
      flatResults.slice(0, 5).forEach((result, index) => {
        console.log(`${index + 1}. "${result.name}"`)
        console.log(`   → Set: "${result.setName}" | Code: "${result.setCode}"`)
        console.log(`   → Price: $${result.price?.marketPrice || 'N/A'}`)
        console.log('   ---')
      })
    }

    return NextResponse.json({
      query,
      categoryId: onePieceCategoryId,
      results: flatResults.slice(0, 100),
      totalFound: flatResults.length,
    })
  } catch (error) {
    console.error("❌ Error searching TCGPlayer:", error)
    return NextResponse.json(
      {
        error: "Failed to search TCGPlayer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// 🎯 FUNÇÃO CORRETA para extrair código do set do extendedData
function extractSetCodeFromExtendedData(extendedData?: Array<{name: string; value: string}>): string | null {
  if (!extendedData) return null

  // Procurar pelo campo "Number" que contém o código completo (ex: "OP06-054")
  const numberField = extendedData.find(data => 
    data.name.toLowerCase() === 'number'
  )

  if (numberField && numberField.value) {
    // Extrair o código do set (parte antes do hífen)
    const setCodeMatch = numberField.value.match(/^([A-Z0-9]+)-\d+/)
    if (setCodeMatch && setCodeMatch[1]) {
      return setCodeMatch[1]
    }
  }

  return null
}

// 🔧 FUNÇÃO para extrair código do nome do set (fallback)
function extractSetCodeFromSetName(setName: string): string {
  const setMappings: Record<string, string> = {
    "romance dawn": "OP01",
    "paramount war": "OP02",
    "pillars of strength": "OP03",
    "kingdoms of intrigue": "OP04",
    "awakening of the new era": "OP05",
    "wings of the captain": "OP06",
    "wings of captain": "OP06",
    "500 years in the future": "OP07",
    "two legends": "OP08",
    
    "starter deck": "ST01",
    "starter deck luffy": "ST01",
    "starter deck ace": "ST02",
    "starter deck nami": "ST03",
    "starter deck kaido": "ST04",
    "starter deck uta": "ST05",
    "starter deck absolute justice": "ST06",
    "starter deck big mom": "ST07",
    "starter deck monkey d luffy": "ST08",
    "starter deck yamato": "ST09",
    "starter deck issho": "ST10",
    "starter deck zoro and sanji": "ST12",
    
    "memorial collection": "EB01",
    "extra booster": "EB01",
    "promotional": "P",
    "promo": "P",
    "pre-release": "PR01",
    "championship": "CH01"
  }

  const lowerSetName = setName.toLowerCase()
  for (const [name, code] of Object.entries(setMappings)) {
    if (lowerSetName.includes(name)) {
      return code
    }
  }

  return "UNK"
}