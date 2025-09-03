import { type NextRequest, NextResponse } from "next/server"

interface ExchangeRateResponse {
  success: boolean
  timestamp: number
  base: string
  date: string
  rates: {
    [key: string]: number
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get("from") || "BRL"
  const to = searchParams.get("to") || "USD"
  const amount = Number.parseFloat(searchParams.get("amount") || "1")

  if (isNaN(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
  }

  try {
    // Using exchangerate-api.com (free tier allows 1500 requests/month)
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${from}`,
      {
        headers: {
          "User-Agent": "OnePieceComparator/1.0",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`)
    }

    const data: ExchangeRateResponse = await response.json()

    if (!data.success && data.success !== undefined) {
      throw new Error("Exchange rate API returned error")
    }

    const rate = data.rates[to]
    if (!rate) {
      throw new Error(`Exchange rate not found for ${from} to ${to}`)
    }

    const convertedAmount = amount * rate

    return NextResponse.json({
      from,
      to,
      amount,
      rate,
      convertedAmount,
      timestamp: data.timestamp || Date.now(),
      date: data.date || new Date().toISOString().split('T')[0],
    })
  } catch (error) {
    console.error("Currency conversion error:", error)
    
    // Fallback to approximate rate if API fails
    const fallbackRate = from === "BRL" && to === "USD" ? 0.20 : 5.0 // Approximate BRL to USD
    const convertedAmount = amount * fallbackRate

    return NextResponse.json({
      from,
      to,
      amount,
      rate: fallbackRate,
      convertedAmount,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      fallback: true,
      warning: "Using fallback exchange rate due to API error"
    })
  }
}
