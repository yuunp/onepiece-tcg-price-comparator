"use client"

import React from "react"
import { TrendingDown, TrendingUp, ExternalLink, Crown, AlertTriangle, CheckCircle, Hash, Package, Sparkles, ArrowUpDown } from "lucide-react"
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

const identifyVariation = (numericCode: string): CardVariation => {
  const variations: { [key: string]: CardVariation } = {
    'E': { code: 'E', name: 'Special', description: 'Edição especial', rarity: 'Special', emoji: '⭐' },
    'AA': { code: 'AA', name: 'Alternate Art', description: 'Arte alternativa', rarity: 'Super Rare', emoji: '🎨' },
    'RE': { code: 'RE', name: 'Reprint', description: 'Reimpressão', rarity: 'Common', emoji: '🔄' },
    'FA': { code: 'FA', name: 'Full Art', description: 'Arte completa', rarity: 'Rare', emoji: '🖼️' },
    'AS': { code: 'AS', name: 'Anniversary Set', description: 'Edição de aniversário', rarity: 'Secret Rare', emoji: '🎂' },
    'BS': { code: 'BS', name: 'Best Selection', description: 'Seleção especial', rarity: 'Super Rare', emoji: '🏆' },
    'CH': { code: 'CH', name: 'Championship', description: 'Edição de campeonato', rarity: 'Promo', emoji: '🥇' },
    'PR': { code: 'PR', name: 'Promo', description: 'Cartão promocional', rarity: 'Promo', emoji: '🎁' },
    'SP': { code: 'SP', name: 'Special', description: 'Edição especial', rarity: 'Special', emoji: '✨' },
    'SR': { code: 'SR', name: 'Super Rare', description: 'Super rara', rarity: 'Super Rare', emoji: '💎' }
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


const calculateSimilarity = (tcgCard: TCGPlayerCard, ligaCard: LigaCard): {
  score: number
  reasons: string[]
  method: string
} => {
  const reasons: string[] = []
  let totalScore = 0

  const tcgSetName = tcgCard.setName?.toLowerCase().trim()
  const ligaSetName = ligaCard.set?.toLowerCase().trim()

  if (tcgSetName && ligaSetName && tcgSetName === ligaSetName) {
    totalScore += 30
    reasons.push(`Same set: "${tcgSetName}" (30%)`)
  }

  const tcgNameNormalized = normalizeName(tcgCard.name)
  const ligaNameNormalized = normalizeName(ligaCard.name)

  if (tcgNameNormalized && ligaNameNormalized) {
    if (tcgNameNormalized === ligaNameNormalized) {
      totalScore += 40
      reasons.push(`Identical name: "${tcgNameNormalized}" (40%)`)
    } else if (tcgNameNormalized.includes(ligaNameNormalized) || 
               ligaNameNormalized.includes(tcgNameNormalized)) {
      totalScore += 0
      reasons.push(`Names similar: "${tcgNameNormalized}" ~ "${ligaNameNormalized}" (25%)`)
    }
  }

  const tcgCode = tcgCard.extendedData?.find(d => d.name === 'Number')?.value || extractCardNumber(tcgCard.name)
  const ligaCode = ligaCard.numericCode

  if (tcgCode && ligaCode) {
    const tcgBase = normalizeCode(tcgCode)
    const ligaBase = normalizeCode(ligaCode)
    
    if (tcgBase === ligaBase) {
      totalScore += 30
      reasons.push(`Base code: ${tcgBase} (30%)`)
    } else {
      const tcgSetFromCode = tcgCode.split('-')[0]
      const ligaSetFromCode = ligaCode.split('-')[0]
      if (tcgSetFromCode === ligaSetFromCode) {
        totalScore += 15
        reasons.push(`Same set in code: ${tcgSetFromCode} (15%)`)
      }
    }
  }

  const finalScore = Math.min(totalScore / 100, 1)
  
  let method = 'Basic Matching'
  if (finalScore >= 0.9) method = 'Perfect Match'
  else if (finalScore >= 0.7) method = 'Good Match'
  else if (finalScore >= 0.5) method = 'Partial Match'

  return {
    score: finalScore,
    reasons,
    method
  }
}

const matchCards = (tcgCards: TCGPlayerCard[], ligaCards: LigaCard[]): CardMatch[] => {
  const matches: CardMatch[] = []
  const usedLigaIndices = new Set<number>()
  const usedTcgIndices = new Set<number>()

  tcgCards.forEach((tcgCard, tcgIndex) => {
    let bestMatch = { index: -1, score: 0, analysis: { score: 0, reasons: [] as string[], method: '' } }

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

  tcgCards.forEach((tcgCard, tcgIndex) => {
    if (usedTcgIndices.has(tcgIndex)) return

    let bestMatch = { index: -1, score: 0, analysis: { score: 0, reasons: [] as string[], method: '' } }

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

  tcgCards.forEach((card, index) => {
    if (!usedTcgIndices.has(index)) {
      matches.push({
        tcgCard: card,
        similarity: 0,
        bestPrice: "tcg",
        matchType: "none",
        matchMethod: 'No match found',
        confidenceScore: 0,
        matchReasons: ['No match found']
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
        matchReasons: ['No match found']
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
    return <div className="text-muted-foreground text-sm">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#22c55e] font-mono">{stats.perfect}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 uppercase tracking-wide">Perfect Matches</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#3b82f6] font-mono">{stats.high + stats.medium}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 uppercase tracking-wide">Good Matches</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground font-mono">{stats.none}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 uppercase tracking-wide">No Match</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary font-mono">{formatCurrency(stats.totalSavings)}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 uppercase tracking-wide">Potential Savings</div>
          </CardContent>
        </Card>
      </div>

      {/* Sorting Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Sort by:</span>
        {([
          { key: 'savings' as const, label: 'Best Deals' },
          { key: 'match' as const, label: 'Best Match' },
          { key: 'price-low' as const, label: 'Lowest Price' },
          { key: 'price-high' as const, label: 'Highest Price' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              sortBy === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted hover:text-foreground border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Comparison List */}
      <div className="space-y-3">
        {sortedMatches.map((match, index) => {
          const ligaPriceUSD = match.ligaCard?.price ? match.ligaCard.price * exchangeRate : 0
          const ligaVariation = match.ligaCard?.numericCode ? identifyVariation(match.ligaCard.numericCode) : null
          
          const borderColor = {
            'perfect': 'border-[#22c55e]/30',
            'high': 'border-[#3b82f6]/30',
            'medium': 'border-primary/30',
            'none': 'border-border',
          }[match.matchType]
          
          return (
            <Card key={index} className={`overflow-hidden transition-all duration-200 hover:border-primary/40 bg-card ${borderColor}`}>
              <CardContent className="p-5 flex flex-col h-full">
                {/* Cards Grid */}
                <div className="grid md:grid-cols-2 gap-5 flex-1 mb-4">
                  
                  {/* TCGPlayer Side */}
                  {match.tcgCard && (
                    <div className="space-y-3 flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#3b82f6] text-[#ffffff] text-[10px] font-medium">TCGPlayer</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Hash className="w-2.5 h-2.5" />
                          {match.tcgCard.extendedData?.find(d => d.name === 'Number')?.value || 'No Code'}
                        </span>
                      </div>

                      <div className="flex gap-3 flex-1">
                        <div className="w-16 h-20 bg-secondary rounded-md overflow-hidden flex-shrink-0">
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
                          <h4 className="font-semibold text-sm line-clamp-2 text-foreground leading-snug">{match.tcgCard.name}</h4>
                          <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                            {match.tcgCard.setName && (
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {match.tcgCard.setName}
                              </div>
                            )}
                          </div>
                          {match.tcgCard.price && (
                            <div className="mt-2 text-sm font-bold text-primary font-mono">
                              ${match.tcgCard.price.marketPrice?.toFixed(2) || 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 border-border hover:bg-secondary hover:text-foreground mt-auto" asChild>
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
                        <Badge className="bg-[#22c55e] text-[#ffffff] text-[10px] font-medium">Liga One Piece</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Hash className="w-2.5 h-2.5" />
                          {match.ligaCard.numericCode || 'No Code'}
                        </span>
                      </div>

                      <div className="flex gap-3 flex-1">
                        <div className="w-16 h-20 bg-secondary rounded-md overflow-hidden flex-shrink-0">
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
                          <h4 className="font-semibold text-sm line-clamp-2 text-foreground leading-snug">{match.ligaCard.name}</h4>
                          <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                            {match.ligaCard.set && (
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {match.ligaCard.set}
                              </div>
                            )}
                            {ligaVariation && (
                              <div className="flex items-center gap-1 text-primary">
                                <Sparkles className="w-3 h-3" />
                                {ligaVariation.name}
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <div className="text-sm font-bold text-primary font-mono">
                              R$ {match.ligaCard.price?.toFixed(2) || 'N/A'}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {'≈'} {formatCurrency(ligaPriceUSD)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" size="sm" className="w-full text-xs h-8 border-border hover:bg-secondary hover:text-foreground mt-auto" asChild>
                        <a href={match.ligaCard.url} target="_blank" rel="noopener noreferrer">
                          View <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Match Info Section */}
                <div className={`p-3 rounded-lg border space-y-2 ${
                  match.matchType === 'perfect' ? 'bg-[#22c55e]/5 border-[#22c55e]/20' :
                  match.matchType === 'high' ? 'bg-[#3b82f6]/5 border-[#3b82f6]/20' :
                  match.matchType === 'medium' ? 'bg-primary/5 border-primary/20' :
                  'bg-secondary border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {match.matchType === "perfect" && (
                        <Badge className="bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/20 text-[10px] font-medium">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Perfect ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "high" && (
                        <Badge className="bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/20 text-[10px] font-medium">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Good ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "medium" && (
                        <Badge className="bg-primary/15 text-primary border border-primary/20 text-[10px] font-medium">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Medium ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "none" && (
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground font-medium">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          No Match
                        </Badge>
                      )}
                    </div>
                    {match.savings && match.savings > 0 && (
                      <Badge className={`gap-1 text-[10px] font-medium ${
                        match.bestPrice === "tcg" 
                          ? 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/20' 
                          : 'bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/20'
                      }`}>
                        <Crown className="w-3 h-3" />
                        Save {formatCurrency(match.savings)}
                      </Badge>
                    )}
                  </div>
                  
                  {match.matchReasons.length > 0 && (
                    <div className="text-[11px] space-y-0.5 pt-2 border-t border-border">
                      {match.matchReasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2 text-muted-foreground">
                          <span className="text-border">{'·'}</span>
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
