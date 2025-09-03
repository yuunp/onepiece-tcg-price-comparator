"use client"

import { useState, useEffect } from "react"
import { ArrowRightLeft, Calculator } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { convertCurrency, formatCurrency, type CurrencyConversion } from "@/lib/currency"

export function CurrencyConverter() {
  const [amount, setAmount] = useState("100")
  const [conversion, setConversion] = useState<CurrencyConversion | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  const handleConvert = async () => {
    const numAmount = Number.parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    setIsConverting(true)
    try {
      const result = await convertCurrency(numAmount, "BRL", "USD")
      setConversion(result)
    } catch (error) {
      console.error("Conversion error:", error)
    } finally {
      setIsConverting(false)
    }
  }

  // Auto-convert when amount changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount && Number.parseFloat(amount) > 0) {
        handleConvert()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [amount])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle>Currency Converter</CardTitle>
        </div>
        <CardDescription>Convert BRL to USD for price comparison</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Amount in BRL</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount in BRL"
            min="0"
            step="0.01"
          />
        </div>

        <div className="flex items-center justify-center">
          <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
        </div>

        {conversion && (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(conversion.convertedAmount, "USD")}
              </div>
              <div className="text-sm text-muted-foreground">
                Rate: 1 BRL = {conversion.rate.toFixed(4)} USD
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last updated:</span>
              <span>{conversion.date}</span>
            </div>

            {conversion.fallback && (
              <Badge variant="outline" className="w-full justify-center text-xs">
                {conversion.warning}
              </Badge>
            )}
          </div>
        )}

        <Button 
          onClick={handleConvert} 
          disabled={isConverting || !amount || Number.parseFloat(amount) <= 0}
          className="w-full"
        >
          {isConverting ? "Converting..." : "Convert"}
        </Button>
      </CardContent>
    </Card>
  )
}
