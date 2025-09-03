"use client"

import { TrendingDown, TrendingUp, ExternalLink, Crown, AlertTriangle, CheckCircle, Target, Hash, Package, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  // Extrair sufixo do código (últimas letras após o hífen)
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
    reasons.push(`📦 Mesmo set: "${tcgSetName}" (30%)`)
  }

  // === 40% NOME DA CARTA ===
  const tcgNameNormalized = normalizeName(tcgCard.name)
  const ligaNameNormalized = normalizeName(ligaCard.name)

  if (tcgNameNormalized && ligaNameNormalized) {
    if (tcgNameNormalized === ligaNameNormalized) {
      totalScore += 40
      reasons.push(`👤 Nome idêntico: "${tcgNameNormalized}" (40%)`)
    } else if (tcgNameNormalized.includes(ligaNameNormalized) || 
               ligaNameNormalized.includes(tcgNameNormalized)) {
      totalScore += 0
      reasons.push(`👤 Nomes similares: "${tcgNameNormalized}" ≈ "${ligaNameNormalized}" (25%)`)
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
      reasons.push(`🎯 Código base: ${tcgBase} (30%)`)
    } else {
      const tcgSetFromCode = tcgCode.split('-')[0]
      const ligaSetFromCode = ligaCode.split('-')[0]
      if (tcgSetFromCode === ligaSetFromCode) {
        totalScore += 15
        reasons.push(`🔶 Mesmo set no código: ${tcgSetFromCode} (15%)`)
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
  tcgCards.forEach((tcgCard, index) => {
    if (!usedTcgIndices.has(index)) {
      matches.push({
        tcgCard,
        similarity: 0,
        bestPrice: "tcg",
        matchType: "none",
        matchMethod: 'Sem correspondência',
        confidenceScore: 0,
        matchReasons: ['❌ Nenhum match encontrado']
      })
    }
  })

  ligaCards.forEach((ligaCard, index) => {
    if (!usedLigaIndices.has(index)) {
      matches.push({
        ligaCard,
        similarity: 0,
        bestPrice: "liga",
        matchType: "none",
        matchMethod: 'Sem correspondência',
        confidenceScore: 0,
        matchReasons: ['❌ Nenhum match encontrado']
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
  const matches = useMemo(() => {
    if (!tcgResults || !ligaResults) return []
    return matchCards(tcgResults, ligaResults)
  }, [tcgResults, ligaResults])

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
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.perfect}</div>
            <div className="text-sm text-muted-foreground">Perfect Match</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.high + stats.medium}</div>
            <div className="text-sm text-muted-foreground">Good Matches</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.none}</div>
            <div className="text-sm text-muted-foreground">No Match</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalSavings)}</div>
            <div className="text-sm text-muted-foreground">Total Savings</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Comparações */}
      <div className="space-y-4">
        {matches.map((match, index) => {
          const ligaPriceUSD = match.ligaCard?.price * exchangeRate
          const ligaVariation = match.ligaCard?.numericCode ? identifyVariation(match.ligaCard.numericCode) : null
          
          return (
            <Card key={index} className={`overflow-hidden ${
              match.matchType === 'perfect' ? 'border-emerald-200 bg-emerald-50' :
              match.matchType === 'high' ? 'border-blue-200 bg-blue-50' :
              match.matchType === 'medium' ? 'border-orange-200 bg-orange-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* TCGPlayer Side */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">TCGPlayer</Badge>
                      {match.tcgCard && (
                        <Badge variant="outline" className="text-xs">
                          <Hash className="w-3 h-3 mr-1" />
                          {match.tcgCard.extendedData?.find(d => d.name === 'Number')?.value || 'No Code'}
                        </Badge>
                      )}
                    </div>

                    {match.tcgCard && (
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                            <img
                              src={match.tcgCard.imageUrl}
                              alt={match.tcgCard.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-card.jpg'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-2">{match.tcgCard.name}</h4>
                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                              {match.tcgCard.setName && (
                                <div className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  {match.tcgCard.setName}
                                </div>
                              )}
                            </div>
                            <div className="mt-2 text-sm font-semibold">
                              {formatCurrency(match.tcgCard.price?.marketPrice || 0)}
                            </div>
                          </div>
                        </div>
                        {match.tcgCard.url && (
                          <Button variant="outline" size="sm" className="w-full" asChild>
                            <a href={match.tcgCard.url} target="_blank" rel="noopener noreferrer">
                              View on TCGPlayer <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Liga One Piece Side */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">Liga One Piece</Badge>
                      {match.ligaCard && (
                        <Badge variant="outline" className="text-xs">
                          <Hash className="w-3 h-3 mr-1" />
                          {match.ligaCard.numericCode || 'No Code'}
                        </Badge>
                      )}
                    </div>

                    {match.ligaCard && (
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                            <img
                              src={match.ligaCard.imageUrl}
                              alt={match.ligaCard.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-card.jpg'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-2">{match.ligaCard.name}</h4>
                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                              {match.ligaCard.set && (
                                <div className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  {match.ligaCard.set}
                                </div>
                              )}
                              {ligaVariation && (
                                <div className="flex items-center gap-1 text-amber-600">
                                  <Sparkles className="w-3 h-3" />
                                  {ligaVariation.name}
                                </div>
                              )}
                            </div>
                            <div className="mt-2">
                              <div className="text-sm font-semibold">
                                {formatCurrency(match.ligaCard.price, "BRL")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ≈ {formatCurrency(ligaPriceUSD)}
                              </div>
                            </div>
                          </div>
                        </div>
                        {match.ligaCard.url && (
                          <Button variant="outline" size="sm" className="w-full" asChild>
                            <a href={match.ligaCard.url} target="_blank" rel="noopener noreferrer">
                              View on Liga <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Info Section */}
                <div className={`mt-4 p-3 rounded-lg border ${
                  match.matchType === 'perfect' ? 'bg-emerald-100 border-emerald-200' :
                  match.matchType === 'high' ? 'bg-blue-100 border-blue-200' :
                  match.matchType === 'medium' ? 'bg-orange-100 border-orange-200' :
                  'bg-gray-100 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {match.matchType === "perfect" && (
                        <Badge className="bg-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Perfect Match ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "high" && (
                        <Badge className="bg-blue-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Good Match ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "medium" && (
                        <Badge className="bg-orange-600">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Medium Match ({match.confidenceScore}%)
                        </Badge>
                      )}
                      {match.matchType === "none" && (
                        <Badge variant="outline">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          No Match
                        </Badge>
                      )}
                    </div>
                    {match.savings && match.savings > 0 && (
                      <Badge variant={match.bestPrice === "tcg" ? "default" : "secondary"} className="gap-1">
                        <Crown className="w-3 h-3" />
                        Save {formatCurrency(match.savings)}
                      </Badge>
                    )}
                  </div>
                  
                  {match.matchReasons.length > 0 && (
                    <div className="text-xs space-y-1">
                      {match.matchReasons.map((reason, i) => (
                        <div key={i} className="flex items-center gap-1 text-muted-foreground">
                          <span>•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ✅ INFO DA VARIAÇÃO */}
                  {ligaVariation && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">Variação:</span>
                        <Badge variant="outline" className="text-xs">
                          {ligaVariation.emoji} {ligaVariation.name}
                        </Badge>
                        <span className="text-muted-foreground">{ligaVariation.description}</span>
                      </div>
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