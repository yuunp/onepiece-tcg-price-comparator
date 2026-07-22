import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch("https://tcgcsv.com/categories.json", {
      headers: {
        "User-Agent": "BountyDex/1.0 (+https://bountydex.yunp.fun)",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const categories = await response.json()
    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}
