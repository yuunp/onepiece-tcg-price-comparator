"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  Zap,
  ExternalLink,
  Loader2,
  Filter,
  Grid,
  List,
  ChevronRight,
  Sparkles,
  TrendingDown,
  BarChart3,
  X,
  ArrowUpDown,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { searchTCGPlayer, type TCGPlayerCard } from "@/lib/tcgplayer"
import { searchLigaOnePiece, type LigaCard, formatLigaPriceWithUSD } from "@/lib/liga"
import { PriceComparison } from "@/components/price-comparison"

export default function OnePieceComparator() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [tcgResults, setTcgResults] = useState<TCGPlayerCard[]>([])
  const [ligaResults, setLigaResults] = useState<LigaCard[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchErrors, setSearchErrors] = useState<{ tcg?: string; liga?: string }>({})
  const [exchangeRate, setExchangeRate] = useState<number>(0.19)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  type SortDir = "asc" | "desc"
  const [tcgSortKey, setTcgSortKey] = useState<"market" | "low" | "high">("market")
  const [tcgSortDir, setTcgSortDir] = useState<SortDir>("asc")
  const [ligaSortDir, setLigaSortDir] = useState<SortDir>("asc")
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const convertUSDToBRL = (usdPrice: number): number => {
    return usdPrice / exchangeRate
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("opc_recent")
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch {}
    }
  }, [])

  const pushRecent = useCallback((q: string) => {
    if (!q.trim()) return
    const next = [q, ...recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8)
    setRecentSearches(next)
    if (typeof window !== "undefined") localStorage.setItem("opc_recent", JSON.stringify(next))
  }, [recentSearches])

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setHasSearched(true)
    setSearchErrors({})

    try {
      const response = await fetch("/api/currency/convert?from=BRL&to=USD&amount=1")
      const data = await response.json()
      if (data.rate) setExchangeRate(data.rate)
    } catch {
      console.log("[v0] Using default exchange rate due to API error")
    }

    const searchPromises = [
      searchTCGPlayer(searchQuery)
        .then((response) => {
          setTcgResults(response.results)
        })
        .catch((error) => {
          console.error("TCGPlayer search error:", error)
          setSearchErrors((prev) => ({ ...prev, tcg: "Failed to search TCGPlayer" }))
          setTcgResults([])
        }),

      searchLigaOnePiece(searchQuery)
        .then((response) => {
          setLigaResults(response.results)
          if (response.exchangeRate) setExchangeRate(response.exchangeRate)
        })
        .catch((error) => {
          console.error("Liga search error:", error)
          setSearchErrors((prev) => ({ ...prev, liga: "Failed to search Liga One Piece" }))
          setLigaResults([])
        }),
    ]

    try {
      await Promise.allSettled(searchPromises)
      pushRecent(searchQuery)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, pushRecent])

  const clearSearch = () => {
    setSearchQuery("")
    setHasSearched(false)
    setTcgResults([])
    setLigaResults([])
    setSearchErrors({})
  }

  const sortedTcg = useMemo(() => {
    const mapKey = (c: TCGPlayerCard) => {
      const p = c.price
      if (!p) return Number.POSITIVE_INFINITY
      const val = tcgSortKey === "market" ? p.marketPrice : tcgSortKey === "low" ? p.lowPrice : p.highPrice
      return typeof val === "number" ? val : Number.POSITIVE_INFINITY
    }
    const arr = [...tcgResults].sort((a, b) => {
      const va = mapKey(a)
      const vb = mapKey(b)
      return tcgSortDir === "asc" ? va - vb : vb - va
    })
    return arr
  }, [tcgResults, tcgSortKey, tcgSortDir])

  const sortedLiga = useMemo(() => {
    const arr = [...ligaResults].sort((a, b) => {
      const va = a.price ?? Number.POSITIVE_INFINITY
      const vb = b.price ?? Number.POSITIVE_INFINITY
      return ligaSortDir === "asc" ? va - vb : vb - va
    })
    return arr
  }, [ligaResults, ligaSortDir])

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:supports-[backdrop-filter]:bg-neutral-950/90">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm overflow-hidden">
              <img 
                src="/jollylupa.png" 
                alt="Logo" 
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white">One Piece Compare</h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Price comparison tool</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="hidden sm:flex gap-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium">
              <Zap className="h-3 w-3" />
              Live Data
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {/* Search Section - Always Visible */}
        <section className={`${hasSearched ? 'py-6 border-b border-neutral-200 dark:border-neutral-800' : 'py-16'} text-center transition-all duration-300`}>
          <div className={`${hasSearched ? 'max-w-3xl' : 'max-w-2xl'} mx-auto`}>
            {!hasSearched && (
              <>
                <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-950/30 mb-6 border border-amber-200 dark:border-amber-800/50">
                  <Sparkles className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-200">Compare prices across platforms</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 text-neutral-900 dark:text-white">
                  Find the Best <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Card Deals</span>
                </h2>
                <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8">Search across TCGPlayer and Liga One Piece to find the best prices for your favorite cards</p>
              </>
            )}

            <form onSubmit={handleSearch} className={`relative mx-auto ${hasSearched ? 'mb-4' : 'mb-8'}`}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Search for cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 pl-12 pr-32 text-base border-2 border-neutral-200 dark:border-neutral-700 focus:border-amber-500 dark:focus:border-amber-500 focus:ring-0 rounded-lg shadow-sm dark:bg-neutral-900"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {!!searchQuery && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearSearch} className="h-10 px-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-11 px-6 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm rounded-lg"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Searching
                      </>
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {!hasSearched && recentSearches.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Recent:
                </span>
                {recentSearches.map((q) => (
                  <Button 
                    key={q} 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full text-xs border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    onClick={() => { setSearchQuery(q); setTimeout(() => handleSearch(), 0) }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>

        {!hasSearched && (
          <section className="py-12 pb-20">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Search, title: "Smart Search", description: "Find cards across multiple platforms instantly" },
                { icon: TrendingDown, title: "Price Tracking", description: "Compare real-time prices from different sellers" },
                { icon: Zap, title: "Live Conversion", description: "Automatic currency conversion with exchange rates" },
              ].map((feature, i) => (
                <Card key={i} className="border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors bg-gradient-to-br from-white via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <feature.icon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="text-sm">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        )} 
        

        {/* Search Results */}
        {hasSearched && (
          <section className="py-8">
            <div className="mb-8">
              <nav className="flex items-center space-x-2 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                <span>Home</span>
                <ChevronRight className="h-4 w-4" />
                <span>Results</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-neutral-900 dark:text-white font-medium">"{searchQuery}"</span>
              </nav>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-3xl font-bold text-neutral-900 dark:text-white mb-1">
                    {isSearching ? "Searching..." : "Results"}
                  </h3>
                  {!isSearching && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Found {tcgResults.length + ligaResults.length} results
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">1 USD =</span>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">R$ {(1 / exchangeRate).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-1 border border-neutral-200 dark:border-neutral-700 rounded-lg p-1 bg-neutral-50 dark:bg-neutral-900">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="h-8 w-8 p-0"
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="h-8 w-8 p-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {isSearching ? (
              <div className="text-center py-20">
                <div className="flex justify-center mb-4">
                  <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">Searching both platforms...</p>
              </div>
            ) : (
              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-11 bg-neutral-100 dark:bg-neutral-900 p-1 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <TabsTrigger 
                    value="comparison" 
                    className="text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-neutral-900 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white rounded-md transition-all"
                  >
                    Comparison
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tcgplayer" 
                    className="text-xs md:text-sm flex items-center gap-1 justify-center data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-blue-400 rounded-md transition-all"
                  >
                    TCGPlayer
                    {tcgResults.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{tcgResults.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="liga" 
                    className="text-xs md:text-sm flex items-center gap-1 justify-center data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-600 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-green-400 rounded-md transition-all"
                  >
                    Liga One Piece
                    {ligaResults.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{ligaResults.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comparison" className="mt-6">
                  <PriceComparison
                    tcgResults={tcgResults}
                    ligaResults={ligaResults}
                    exchangeRate={exchangeRate || undefined}
                  />
                </TabsContent>

                <TabsContent value="tcgplayer" className="mt-6">
                  {searchErrors.tcg ? (
                    <div className="flex items-center justify-center py-20 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      <p>{searchErrors.tcg}</p>
                    </div>
                  ) : sortedTcg.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Sort:</span>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setTcgSortKey("market")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              tcgSortKey === "market"
                                ? 'bg-blue-500 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            }`}
                          >
                            Market Price
                          </button>
                          <button
                            onClick={() => setTcgSortKey("low")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              tcgSortKey === "low"
                                ? 'bg-emerald-500 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            }`}
                          >
                            Low Price
                          </button>
                          <button
                            onClick={() => setTcgSortKey("high")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              tcgSortKey === "high"
                                ? 'bg-purple-500 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            }`}
                          >
                            High Price
                          </button>
                          <button
                            onClick={() => setTcgSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                          >
                            {tcgSortDir === "asc" ? "↑" : "↓"} {tcgSortDir === "asc" ? "Low to High" : "High to Low"}
                          </button>
                        </div>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
                        {sortedTcg.map((card) => (
                          <Card
                            key={card.productId}
                            className="overflow-hidden hover:shadow-md transition-all duration-200 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 group"
                          >
                            <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                                  <span className="text-xs text-neutral-400">No image</span>
                                </div>
                              )}
                              <Badge className="absolute top-2 right-2 bg-blue-500 text-white text-xs">TCGPlayer</Badge>
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-neutral-900 dark:text-white mb-3 line-clamp-2 text-sm">{card.name}</h4>
                              {card.price && (
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-neutral-600 dark:text-neutral-400">Market:</span>
                                    <div className="text-right">
                                      <div className="font-bold text-blue-600 dark:text-blue-400">
                                        ${card.price.marketPrice?.toFixed(2) || "N/A"}
                                      </div>
                                      {card.price.marketPrice && (
                                        <div className="text-neutral-500 dark:text-neutral-400">
                                          R$ {convertUSDToBRL(card.price.marketPrice).toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8 border-neutral-200 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400" asChild>
                                <a href={card.url} target="_blank" rel="noopener noreferrer">
                                  View
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-20">
                      <Search className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
                      <p className="text-neutral-600 dark:text-neutral-400">No results found</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="liga" className="mt-6">
                  {searchErrors.liga ? (
                    <div className="flex items-center justify-center py-20 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      <p>{searchErrors.liga}</p>
                    </div>
                  ) : sortedLiga.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Sort:</span>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setLigaSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              ligaSortDir === "asc"
                                ? 'bg-green-500 text-white'
                                : 'bg-purple-500 text-white'
                            }`}
                          >
                            {ligaSortDir === "asc" ? "↑" : "↓"} {ligaSortDir === "asc" ? "Low to High" : "High to Low"}
                          </button>
                        </div>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
                        {sortedLiga.map((card, index) => (
                          <Card
                            key={index}
                            className="overflow-hidden hover:shadow-md transition-all duration-200 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 group"
                          >
                            <div className="aspect-[3/4] bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                                  <span className="text-xs text-neutral-400">No image</span>
                                </div>
                              )}
                              <Badge className="absolute top-2 right-2 bg-green-500 text-white text-xs">Liga One Piece</Badge>
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-neutral-900 dark:text-white mb-3 line-clamp-2 text-sm">{card.name}</h4>
                              {card.price > 0 && (
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-neutral-600 dark:text-neutral-400">Price:</span>
                                    <div className="text-right">
                                      <div className="font-bold text-green-600 dark:text-green-400">
                                        {formatLigaPriceWithUSD(card.price, card.priceUSD)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8 border-neutral-200 dark:border-neutral-700 hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-600 dark:hover:text-green-400" asChild>
                                <a href={card.url} target="_blank" rel="noopener noreferrer">
                                  View
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-20">
                      <Search className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
                      <p className="text-neutral-600 dark:text-neutral-400">No results found</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm overflow-hidden">
                <img 
                  src="/jollylupa.png" 
                  alt="Logo" 
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                One Piece Compare
              </span>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
              The simplest way to compare One Piece card prices across platforms
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}