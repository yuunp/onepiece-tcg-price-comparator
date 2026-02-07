"use client"

import React from "react"
import { TrendingDown, TrendingUp, ExternalLink, Crown, AlertTriangle, CheckCircle, Hash, Package, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TCGPlayerCard } from "@/lib/tcgplayer"
import type { LigaCard } from "@/lib/liga"
import { useMemo } from "react"

type BestPrice = "tcg" | "liga" | "tie"
type MatchType = "perfect" | "high" | "medium" | "none"

interface CardVariation {
  code: string
  name: string 
  description: string
  rarity?: string
  emoji: string
}

interface CardMatch {
  tcgCard?: TCGPlayerCard
  ligaCard?: LigaCard
  similarity: number
  bestPrice: BestPrice
  savings?: number
  matchType: MatchType
  matchMethod?: string
  confidenceScore: number
  matchReasons: string[]
}

interface PriceComparisonProps {
  tcgResults: TCGPlayerCard[]
  ligaResults: LigaCard[]
  exchangeRate?: number
}

// ===== SISTEMA DE IDENTIFICAÇÃO DE VARIAÇÕES =====
const identifyVariation = (numericCode: string): CardVariation => {
  const variations: { [key: string]: CardVariation } = {
    'E': {
      code: 'E',
      name: 'Special',
      description: 'Edição especial',
      rarity: 'Special',
      emoji: '⭐'
    },
    'AA': {
      code: 'AA', 
      name: 'Alternate Art',
      description: 'Arte alternativa',
      rarity: 'Super Rare',
      emoji: '🎨'
    },
    'RE': {
      code: 'RE',
      name: 'Reprint', 
      description: 'Reimpressão',
      rarity: 'Common',
      emoji: '🔄'
    },
    'FA': {
      code: 'FA',
      name: 'Full Art',
      description: 'Arte completa',
      rarity: 'Rare',
      emoji: '🖼️'
    },
    'AS': {
      code: 'AS',
      name: 'Anniversary Set',
      description: 'Edição de aniversário',
      rarity: 'Secret Rare',
      emoji: '🎂'
    },
    'BS': {
      code: 'BS',
      name: 'Best Selection',
      description: 'Seleção especial',
      rarity: 'Super Rare',
      emoji: '🏆'
    },
    'CH': {
      code: 'CH',
      name: 'Championship',
      description: 'Edição de campeonato',
      rarity: 'Promo',
      emoji: '🥇'
    },
    'PR': {
      code: 'PR',
      name: 'Promo',
      description: 'Cartão promocional',
      rarity: 'Promo',
      emoji: '🎁'
    },
    'SP': {
      code: 'SP',
      name: 'Special',
      description: 'Edição especial',
      rarity: 'Special',
      emoji: '✨'
    },
    'SR': {
      code: 'SR',
      name: 'Super Rare',
      description: 'Super rara',
      rarity: 'Super Rare',
      emoji: '💎'
    }
  }

  const suffix = numericCode.split('-').pop()?.replace(/^\d+/, '') || ''
  
  return variations[suffix] || {
    code: suffix,
    name: 'Standard',
    description: 'Versão padrão',
    rarity: 'Normal',
    emoji: '📄'
  }
}

// ===== ALGORITMO 40% NOME - 30% SET - 30% CÓDIGO =====
const extractCardNumber = (name: string): string | null => {
  if (!name) return null
  const patterns = [
    /(OP\d{2}-\d{3}[A-Z]*)/i,
    /(ST\d{2}-\d{3}[A-Z]*)/i,
    /(EB\d{2}-\d{3}[A-Z]*)/i,
    /(PRB\d{2}-\d{3}[A-Z]*)/i,
    /(P-\d{3}[A-Z]*)/i,
    /([A-Z]{2,4}\d{1,2}-\d{3}[A-Z]*)/i
  ]
  
  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) return match[1].toUpperCase()
  }
  
  return null
}

const normalizeName = (name: string): string => {
  if (!name) return ''
  
  let cleaned = name.replace(/(OP\d{2}-\d{3}[A-Z]*)/gi, '')
                   .replace(/(ST\d{2}-\d{3}[A-Z]*)/gi, '')
                   .replace(/(EB\d{2}-\d{3}[A-Z]*)/gi, '')
                   .replace(/(P-\d{3}[A-Z]*)/gi, '')
                   .replace(/([A-Z]{2,4}\d{1,2}-\d{3}[A-Z]*)/gi, '')
  
  cleaned = cleaned.replace(/\s+/g, ' ')
                  .replace(/[\(\]\[]/g, '')
                  .trim()
                  .toLowerCase()
  
  return cleaned
}

const normalizeCode = (code: string): string => {
  if (!code) return ''
  return code.replace(/[-_][A-Z]{1,3}$/, '')
}

// 🎯 ALGORITMO 40% NOME - 30% SET - 30% CÓDIGO
const calculateSimilarity = (tcgCard: TCGPlayerCard, ligaCard: LigaCard): {
  score: number
  reasons: string[]
  method: string
} => {
  const reasons: string[] = []
  let totalScore = 0

  // === 30% NOME DO SET ===
  const tcgSetName = tcgCard.setName?.toLowerCase().trim()
  const ligaSetName = ligaCard.set?.toLowerCase().trim()

  if (tcgSetName && ligaSetName && tcgSetName === ligaSetName) {
    totalScore += 30
    reasons.push(`📦 Same set: "${tcgSetName}" (30%)`)
  }

  // === 40% NOME DA CARTA ===
  const tcgNameNormalized = normalizeName(tcgCard.name)
  const ligaNameNormalized = normalizeName(ligaCard.name)

  if (tcgNameNormalized && ligaNameNormalized) {
    if (tcgNameNormalized === ligaNameNormalized) {
      totalScore += 40
      reasons.push(`👤 Identical name: "${tcgNameNormalized}" (40%)`)
    } else if (tcgNameNormalized.includes(ligaNameNormalized) || 
               ligaNameNormalized.includes(tcgNameNormalized)) {
      totalScore += 0
      reasons.push(`👤 Names similar: "${tcgNameNormalized}" ≈ "${ligaNameNormalized}" (25%)`)
    }
  }

  // === 30% CÓDIGO ===
  const tcgCode = tcgCard.extendedData?.find(d => d.name === 'Number')?.value || extractCardNumber(tcgCard.name)
  const ligaCode = ligaCard.numericCode

  if (tcgCode && ligaCode) {
    const tcgBase = normalizeCode(tcgCode)
    const ligaBase = normalizeCode(ligaCode)
    
    if (tcgBase === ligaBase) {
      totalScore += 30
      reasons.push(`🎯 Base code: ${tcgBase} (30%)`)
    } else {
      const tcgSetFromCode = tcgCode.split('-')[0]
      const ligaSetFromCode = ligaCode.split('-')[0]
      if (tcgSetFromCode === ligaSetFromCode) {
        totalScore += 15
        reasons.push(`🔶 Same set in code: ${tcgSetFromCode} (15%)`)
      }
    }
  }

  const finalScore = Math.min(totalScore / 100, 1)
  
  let method = 'Basic Matching'
  if (finalScore >= 0.9) method = '🎯 Perfect Match'
  else if (finalScore >= 0.7) method = '🔶 Good Match'
  else if (finalScore >= 0.5) method = '🟡 Partial Match'

  return {
    score: finalScore,
    reasons,
    method
  }
}

// 🔥 ALGORITMO PRINCIPAL
const matchCards = (tcgCards: TCGPlayerCard[], ligaCards: LigaCard[]): CardMatch[] => {
  const matches: CardMatch[] = []
  const usedLigaIndices = new Set<number>()
  const usedTcgIndices = new Set<number>()

  // PRIMEIRA PASSADA: MATCHES PERFEITOS (90%+)
  tcgCards.forEach((tcgCard, tcgIndex) => {
    let bestMatch = { index: -1, score: 0, analysis: { score: 0, reasons: [], method: '' } }

    ligaCards.forEach((ligaCard, ligaIndex) => {
      if (usedLigaIndices.has(ligaIndex)) return

      const analysis = calculateSimilarity(tcgCard, ligaCard)
      if (analysis.score > bestMatch.score && analysis.score >= 0.8) {
        bestMatch = { index: ligaIndex, score: analysis.score, analysis }
      }
    })

    if (bestMatch.index !== -1) {
      usedLigaIndices.add(bestMatch.index)
      usedTcgIndices.add(tcgIndex)
      matches.push(createCardMatch(tcgCard, ligaCards[bestMatch.index], bestMatch.analysis))
    }
  })

  // SEGUNDA PASSADA: MATCHES BONS (60-79%)
  tcgCards.forEach((tcgCard, tcgIndex) => {
    if (usedTcgIndices.has(tcgIndex)) return

    let bestMatch = { index: -1, score: 0, analysis: { score: 0, reasons: [], method: '' } }

    ligaCards.forEach((ligaCard, ligaIndex) => {
      if (usedLigaIndices.has(ligaIndex)) return

      const analysis = calculateSimilarity(tcgCard, ligaCard)
      if (analysis.score > bestMatch.score && analysis.score >= 0.6) {
        bestMatch = { index: ligaIndex, score: analysis.score, analysis }
      }
    })

    if (bestMatch.index !== -1) {
      usedLigaIndices.add(bestMatch.index)
      usedTcgIndices.add(tcgIndex)
      matches.push(createCardMatch(tcgCard, ligaCards[bestMatch.index], bestMatch.analysis))
    }
  })

  // CARTAS NÃO MATCHED
  tcgCards.forEach((card, index) => {
    if (!usedTcgIndices.has(index)) {
      matches.push({
        tcgCard: card,
        similarity: 0,
        bestPrice: "tcg",
        matchType: "none",
        matchMethod: 'No match found',
        confidenceScore: 0,
        matchReasons: ['❌ No match found']
      })
    }
  })

  ligaCards.forEach((card, index) => {
    if (!usedLigaIndices.has(index)) {
      matches.push({
        ligaCard: card,
        similarity: 0,
        bestPrice: "liga",
        matchType: "none",
        matchMethod: 'No match found',
        confidenceScore: 0,
        matchReasons: ['❌ No match found']
      })
    }
  })

  return matches
}

const createCardMatch = (tcgCard: TCGPlayerCard, ligaCard: LigaCard, analysis: {
  score: number
  reasons: string[]
  method: string
}): CardMatch => {
  const tcgPrice = tcgCard.price?.marketPrice || 0
  const ligaPriceUSD = ligaCard.price * 0.19
  
  let bestPrice: BestPrice = "tie"
  let savings = 0
  
  if (tcgPrice < ligaPriceUSD) {
    bestPrice = "tcg"
    savings = ligaPriceUSD - tcgPrice
  } else if (tcgPrice > ligaPriceUSD) {
    bestPrice = "liga"
    savings = tcgPrice - ligaPriceUSD
  }
  
  let matchType: MatchType = "none"
  if (analysis.score >= 0.9) matchType = "perfect"
  else if (analysis.score >= 0.7) matchType = "high"
  else if (analysis.score >= 0.5) matchType = "medium"
  
  return {
    tcgCard,
    ligaCard,
    similarity: analysis.score,
    bestPrice,
    savings,
    matchType,
    matchMethod: analysis.method,
    confidenceScore: Math.round(analysis.score * 100),
    matchReasons: analysis.reasons
  }
}

const formatCurrency = (amount: number, currency: string = "USD"): string => {
  if (amount == null || isNaN(amount)) return "N/A"
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency === "BRL" ? "BRL" : "USD",
  }).format(amount)
}

// ===== COMPONENTE PRINCIPAL =====

export const PriceComparison = ({ tcgResults, ligaResults, exchangeRate = 0.19 }: PriceComparisonProps) => {
  const [sortBy, setSortBy] = React.useState<'savings' | 'match' | 'price-low' | 'price-high'>('savings')
  
  const matches = useMemo(() => {
    if (!tcgResults || !ligaResults) return []
    return matchCards(tcgResults, ligaResults)
  }, [tcgResults, ligaResults])

  const sortedMatches = useMemo(() => {
    const sorted = [...matches]
    
    switch (sortBy) {
      case 'savings':
        return sorted.sort((a, b) => (b.savings || 0) - (a.savings || 0))
      case 'match':
        return sorted.sort((a, b) => {
          const matchOrder = { 'perfect': 3, 'high': 2, 'medium': 1, 'none': 0 }
          return matchOrder[b.matchType as keyof typeof matchOrder] - matchOrder[a.matchType as keyof typeof matchOrder]
        })
      case 'price-low': {
        return sorted.sort((a, b) => {
          const priceA = Math.min(a.tcgCard?.price?.marketPrice || Infinity, a.ligaCard?.price ? a.ligaCard.price * exchangeRate : Infinity)
          const priceB = Math.min(b.tcgCard?.price?.marketPrice || Infinity, b.ligaCard?.price ? b.ligaCard.price * exchangeRate : Infinity)
          return priceA - priceB
        })
      }
      case 'price-high': {
        return sorted.sort((a, b) => {
          const priceA = Math.max(a.tcgCard?.price?.marketPrice || 0, a.ligaCard?.price ? a.ligaCard.price * exchangeRate : 0)
          const priceB = Math.max(b.tcgCard?.price?.marketPrice || 0, b.ligaCard?.price ? b.ligaCard.price * exchangeRate : 0)
          return priceB - priceA
        })
      }
      default:
        return sorted
    }
  }, [matches, sortBy, exchangeRate])

  const stats = useMemo(() => ({
    perfect: matches.filter(m => m.matchType === 'perfect').length,
    high: matches.filter(m => m.matchType === 'high').length,
    medium: matches.filter(m => m.matchType === 'medium').length,
    none: matches.filter(m => m.matchType === 'none').length,
    tcgBetter: matches.filter(m => m.bestPrice === "tcg" && m.savings && m.savings > 0).length,
    ligaBetter: matches.filter(m => m.bestPrice === "liga" && m.savings && m.savings > 0).length,
    totalSavings: matches.reduce((sum, m) => sum + (m.savings || 0), 0)
  }), [matches])

  if (!tcgResults || !ligaResults) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.perfect}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mt-1">Perfect Matches</div>
          </CardContent>
        </Card>
        <Card className="border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.high + stats.medium}</div>
            <div className="text-xs text-blue-700 dark:text-blue-300 font-medium mt-1">Good Matches</div>
          </CardContent>
        </Card>
        <Card className="border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.none}</div>
            <div className="text-xs text-orange-700 dark:text-orange-300 font-medium mt-1">No Match</div>
          </CardContent>
        </Card>
        <Card className="border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.totalSavings)}</div>
            <div className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-1">Potential Savings</div>
          </CardContent>
        </Card>
      </div>

      {/* Sorting Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Sort by:</span>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSortBy('savings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'savings'
                ? 'bg-amber-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            💰 Best Deals
          </button>
          <button
            onClick={() => setSortBy('match')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'match'
                ? 'bg-emerald-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            ✓ Best Match
          </button>
          <button
            onClick={() => setSortBy('price-low')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'price-low'
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            ↓ Lowest Price
          </button>
          <button
            onClick={() => setSortBy('price-high')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'price-high'
                ? 'bg-purple-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            ↑ Highest Price
          </button>
        </div>
      </div>

      {/* Comparison List */}
      <div className="space-y-3">
        {sortedMatches.map((match, index) => {
          const ligaPriceUSD = match.ligaCard?.price ? match.ligaCard.price * exchangeRate : 0
          const ligaVariation = match.ligaCard?.numericCode ? identifyVariation(match.ligaCard.numericCode) : null
          
          const bgColorClass = {
            'perfect': 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20',
            'high': 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20',
            'medium': 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20',
            'none': 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900'
          }[match.matchType]
          
          return (
            <Card key={index} className={`overflow-hidden transition-all duration-200 hover:shadow-md ${bgColorClass}`}>
              <CardContent className="p-5 flex flex-col h-full">
                {/* Cards Grid */}
                <div className="grid md:grid-cols-2 gap-5 flex-1 mb-4">
                  
                  {/* TCGPlayer Side */}
                  {match.tcgCard && (
                    <div className="space-y-3 flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500 text-white text-xs">TCGPlayer</Badge>
                        <Badge variant="outline" className="text-xs border-neutral-300 dark:border-neutral-600">
                          <Hash className="w-3 h-3 mr-1" />
                          {match.tcgCard.extendedData?.find(d => d.name === 'Number')?.value || 'No Code'}
                        </Badge>
                      </div>

                      <div className="flex gap-3 flex-1">
                        <div className="w-16 h-20 bg-neutral-200 dark:bg-neutral-700 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={match.tcgCard.imageUrl}
                            alt={match.tcgCard.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg'
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-2 text-neutral-900 dark:text-white">{match.tcgCard.name}</h4>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 space-y-1">
                            {match.tcgCard.setName && (
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {match.tcgCard.setName}
                              </div>
                            )}
                          </div>
                          {match.tcgCard.price && (
                            <div className="mt-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                              ${match.tcgCard.price.marketPrice?.toFixed(2) || 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 border-neutral-300 dark:border-neutral-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 mt-auto" asChild>
                        <a href={match.tcgCard.url} target="_blank" rel="noopener noreferrer">
                          View <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}

                  {/* Liga One Piece Side */}
                  {match.ligaCard && (
                    <div className="space-y-3 flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500 text-white text-xs">Liga One Piece</Badge>
                        <Badge variant="outline" className="text-xs border-neutral-300 dark:border-neutral-600">
                          <Hash className="w-3 h-3 mr-1" />
                          {match.ligaCard.numericCode || 'No Code'}
                        </Badge>
                      </div>

                      <div className="flex gap-3 flex-1">
                        <div className="w-16 h-20 bg-neutral-200 dark:bg-neutral-700 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={match.ligaCard.imageUrl}
                            alt={match.ligaCard.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg'
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-2 text-neutral-900 dark:text-white">{match.ligaCard.name}</h4>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 space-y-1">
                            {match.ligaCard.set && (
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {match.ligaCard.set}
                              </div>
                            )}
                            {ligaVariation && (
                              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Sparkles className="w-3 h-3" />
                                {ligaVariation.name}
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">
                              R$ {match.ligaCard.price?.toFixed(2) || 'N/A'}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">
                              ≈ {formatCurrency(ligaPriceUSD)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" size="sm" className="w-full text-xs h-8 border-neutral-300 dark:border-neutral-600 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600 dark:hover:text-green-400 mt-auto" asChild>
                        <a href={match.ligaCard.url} target="_blank" rel="noopener noreferrer">
                          View <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Match Info Section */}
                <div className={`p-3 rounded-lg border space-y-2 ${
                  match.matchType === 'perfect' ? 'bg-emerald-100/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700' :
                  match.matchType === 'high' ? 'bg-blue-100/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700' :
                  match.matchType === 'medium' ? 'bg-orange-100/50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700' :
                  'bg-neutral-100/50 dark:bg-neutral-900/30 border-neutral-300 dark:border-neutral-600'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {match.matchType === "perfect" && (
                        <Badge className="bg-emerald-600 text-white text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Perfect ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "high" && (
                        <Badge className="bg-blue-600 text-white text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Good ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "medium" && (
                        <Badge className="bg-orange-600 text-white text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Medium ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "none" && (
                        <Badge variant="outline" className="text-xs border-neutral-400 dark:border-neutral-500">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          No Match
                        </Badge>
                      )}
                    </div>
                    {match.savings && match.savings > 0 && (
                      <Badge className={`gap-1 text-xs text-white ${match.bestPrice === "tcg" ? 'bg-blue-600' : 'bg-green-600'}`}>
                        <Crown className="w-3 h-3" />
                        Save {formatCurrency(match.savings)}
                      </Badge>
                    )}
                  </div>
                  
                  {match.matchReasons.length > 0 && (
                    <div className="text-xs space-y-1 pt-2 border-t border-current border-opacity-10">
                      {match.matchReasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2 text-neutral-700 dark:text-neutral-300">
                          <span>•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}