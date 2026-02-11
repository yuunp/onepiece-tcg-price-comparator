"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  Zap,
  ExternalLink,
  Loader2,
  Grid,
  List,
  ChevronRight,
  TrendingDown,
  X,
  Clock,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden ring-1 ring-border">
              <img 
                src="/jollylupa.png" 
                alt="One Piece Compare logo" 
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold text-foreground tracking-tight">One Piece Compare</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Price comparison tool</p>
            </div>
          </div>

          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary text-xs font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Search Section */}
        <section className={`${hasSearched ? 'py-6' : 'py-20 md:py-28'} text-center transition-all duration-500`}>
          <div className={`${hasSearched ? 'max-w-3xl' : 'max-w-2xl'} mx-auto`}>
            {!hasSearched && (
              <div className="mb-10">
                <p className="text-xs font-medium uppercase tracking-widest text-primary mb-4">Compare prices across platforms</p>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance">
                  Find the Best Card Deals
                </h2>
                <p className="text-base text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
                  Search across TCGPlayer and Liga One Piece to find the best prices for your favorite cards.
                </p>
              </div>
            )}

            <form onSubmit={handleSearch} className={`relative mx-auto ${hasSearched ? 'mb-0' : 'mb-8'}`}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search for cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-11 pr-28 text-sm bg-secondary border-border focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-lg placeholder:text-muted-foreground"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {!!searchQuery && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearSearch} className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-9 px-5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        <span className="hidden sm:inline">Searching</span>
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
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Recent:
                </span>
                {recentSearches.map((q) => (
                  <Button 
                    key={q} 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full text-xs h-7 border-border text-secondary-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => { setSearchQuery(q); setTimeout(() => handleSearch(), 0) }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Feature Cards - Home Only */}
        {!hasSearched && (
          <section className="pb-20">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Search, title: "Smart Search", description: "Find cards across multiple platforms instantly" },
                { icon: TrendingDown, title: "Price Tracking", description: "Compare real-time prices from different sellers" },
                { icon: Zap, title: "Live Conversion", description: "Automatic currency conversion with live rates" },
              ].map((feature, i) => (
                <Card key={i} className="bg-card border-border hover:border-primary/30 transition-colors group">
                  <CardHeader className="text-center pb-3">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">{feature.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        )} 

        {/* Search Results */}
        {hasSearched && (
          <section className="py-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
              <button onClick={clearSearch} className="hover:text-foreground transition-colors">Home</button>
              <ChevronRight className="h-3 w-3" />
              <span>Results</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{'"'}{searchQuery}{'"'}</span>
            </nav>

            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  {isSearching ? "Searching..." : "Results"}
                </h3>
                {!isSearching && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Found {tcgResults.length + ligaResults.length} results across platforms
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs">
                  <span className="text-muted-foreground">1 USD =</span>
                  <span className="font-semibold text-foreground font-mono">R$ {(1 / exchangeRate).toFixed(2)}</span>
                </div>

                <div className="flex items-center border border-border rounded-md p-0.5 bg-secondary">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`h-7 w-7 p-0 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Grid className="h-3.5 w-3.5" />
                    <span className="sr-only">Grid view</span>
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-7 w-7 p-0 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span className="sr-only">List view</span>
                  </Button>
                </div>
              </div>
            </div>

            {isSearching ? (
              <div className="text-center py-24">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Searching both platforms...</p>
              </div>
            ) : (
              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-10 bg-secondary p-1 border border-border rounded-lg">
                  <TabsTrigger 
                    value="comparison" 
                    className="text-xs font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all"
                  >
                    Comparison
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tcgplayer" 
                    className="text-xs font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all"
                  >
                    TCGPlayer
                    {tcgResults.length > 0 && (
                      <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{tcgResults.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="liga" 
                    className="text-xs font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all"
                  >
                    Liga One Piece
                    {ligaResults.length > 0 && (
                      <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{ligaResults.length}</span>
                    )}
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
                    <div className="flex items-center justify-center py-20 text-destructive">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <p className="text-sm">{searchErrors.tcg}</p>
                    </div>
                  ) : sortedTcg.length > 0 ? (
                    <>
                      {/* Sort Controls */}
                      <div className="flex items-center gap-2 flex-wrap mb-5">
                        <span className="text-xs text-muted-foreground font-medium">Sort:</span>
                        {(["market", "low", "high"] as const).map((key) => (
                          <button
                            key={key}
                            onClick={() => setTcgSortKey(key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                              tcgSortKey === key
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-muted hover:text-foreground border border-border'
                            }`}
                          >
                            {key === "market" ? "Market" : key === "low" ? "Low" : "High"} Price
                          </button>
                        ))}
                        <button
                          onClick={() => setTcgSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-muted hover:text-foreground border border-border transition-all flex items-center gap-1"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {tcgSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
                        {sortedTcg.map((card) => (
                          <Card
                            key={card.productId}
                            className="overflow-hidden border-border bg-card hover:border-primary/30 transition-all duration-200 group"
                          >
                            <div className="aspect-[3/4] bg-secondary relative overflow-hidden">
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
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">No image</span>
                                </div>
                              )}
                              <Badge className="absolute top-2 right-2 bg-[#3b82f6] text-[#ffffff] text-[10px] font-medium">TCGPlayer</Badge>
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-foreground mb-3 line-clamp-2 text-sm leading-snug">{card.name}</h4>
                              {card.price && (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Market:</span>
                                    <div className="text-right">
                                      <div className="font-bold text-primary font-mono">
                                        ${card.price.marketPrice?.toFixed(2) || "N/A"}
                                      </div>
                                      {card.price.marketPrice && (
                                        <div className="text-muted-foreground font-mono">
                                          R$ {convertUSDToBRL(card.price.marketPrice).toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8 border-border hover:bg-secondary hover:text-foreground" asChild>
                                <a href={card.url} target="_blank" rel="noopener noreferrer">
                                  View on TCGPlayer
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-24">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-4">
                        <Search className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No results found on TCGPlayer</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="liga" className="mt-6">
                  {searchErrors.liga ? (
                    <div className="flex items-center justify-center py-20 text-destructive">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <p className="text-sm">{searchErrors.liga}</p>
                    </div>
                  ) : sortedLiga.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-5">
                        <span className="text-xs text-muted-foreground font-medium">Sort:</span>
                        <button
                          onClick={() => setLigaSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground transition-all flex items-center gap-1"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {ligaSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
                        {sortedLiga.map((card, index) => (
                          <Card
                            key={index}
                            className="overflow-hidden border-border bg-card hover:border-primary/30 transition-all duration-200 group"
                          >
                            <div className="aspect-[3/4] bg-secondary relative overflow-hidden">
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
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">No image</span>
                                </div>
                              )}
                              <Badge className="absolute top-2 right-2 bg-[#22c55e] text-[#ffffff] text-[10px] font-medium">Liga One Piece</Badge>
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-foreground mb-3 line-clamp-2 text-sm leading-snug">{card.name}</h4>
                              {card.price > 0 && (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Price:</span>
                                    <div className="text-right">
                                      <div className="font-bold text-primary font-mono">
                                        {formatLigaPriceWithUSD(card.price, card.priceUSD)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8 border-border hover:bg-secondary hover:text-foreground" asChild>
                                <a href={card.url} target="_blank" rel="noopener noreferrer">
                                  View on Liga
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-24">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-4">
                        <Search className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No results found on Liga One Piece</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md overflow-hidden ring-1 ring-border">
                <img 
                  src="/jollylupa.png" 
                  alt="Logo" 
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-sm font-semibold text-foreground">One Piece Compare</span>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              The simplest way to compare One Piece card prices across platforms.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
