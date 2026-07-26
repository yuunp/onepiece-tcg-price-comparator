import { type NextRequest, NextResponse } from "next/server"
import { BRL_TO_USD_FALLBACK_RATE } from "@/lib/runtime-config"
import { buildConversion, type ExchangeRateResponse, getCachedRate, setCachedRate } from "@/lib/currency"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get("from") || "BRL"
  const to = searchParams.get("to") || "USD"
  const amount = Number.parseFloat(searchParams.get("amount") || "1")

  if (Number.isNaN(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
  }

  const cachedRate = getCachedRate(from, to)
  if (cachedRate != null) {
    return NextResponse.json(buildConversion(from, to, amount, cachedRate))
  }

  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`, {
      headers: {
        "User-Agent": "BountyDex/1.0",
      },
      next: { revalidate: 600 },
    })

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

    setCachedRate(from, to, rate)

    return NextResponse.json(
      buildConversion(from, to, amount, rate, {
        timestamp: data.timestamp,
        date: data.date,
      }),
    )
  } catch (error) {
    console.error("Currency conversion error:", error)

    const fallbackRate = from === "BRL" && to === "USD" ? BRL_TO_USD_FALLBACK_RATE : 1 / BRL_TO_USD_FALLBACK_RATE
    return NextResponse.json(
      buildConversion(from, to, amount, fallbackRate, {
        fallback: true,
        warning: "Using fallback exchange rate due to API error",
      }),
    )
  }
}
