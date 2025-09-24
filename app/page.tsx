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
  Ship,
  Coins,
  BarChart3,
  XCircle,
  ArrowUpDown,
  History,
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

  const SortButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <Button variant="outline" size="sm" onClick={onClick} className="h-8 gap-1 text-base">
      <ArrowUpDown className="h-4 w-4" />
      {label}
    </Button>
  )

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 text-lg"
      style={{ fontFamily: 'Inter, \"SF Pro Display\", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}
    >
      <header className="sticky top-0 z-50 w-full border-b bg-white/90 dark:bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-950/80">
        <div className="container flex h-20 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md overflow-hidden">
              <img 
                src="/jollylupa.png" 
                alt="Jolly Lupa Logo" 
                className="h-full w-full object-cover"
                 />
              </div>
            <div className="flex flex-col">
              <h1 className="text-2xl md:text-3xl font-extrabold leading-none bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                One Piece Comparator
              </h1>
              <p className="text-base md:text-lg text-muted-foreground"></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-base md:text-lg px-3 py-1">
              <Zap className="h-4 w-4" />
              Live Prices
            </Badge>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="default" className="gap-2 bg-white/60 dark:bg-slate-800/60 text-base h-10">
                  <Filter className="h-5 w-5" />
                  <span className="hidden sm:inline">Filters</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-white/95 dark:bg-slate-950/95 backdrop-blur">
                <SheetHeader>
                  <SheetTitle className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent text-2xl">
                    Filter Options
                  </SheetTitle>
                  <SheetDescription className="text-base">
                    Refine your search results
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div>
                    <h4 className="text-lg font-medium mb-2">Price Range</h4>
                    <div className="space-y-2">
                      <Input placeholder="Min price" type="number" className="h-12 text-base" />
                      <Input placeholder="Max price" type="number" className="h-12 text-base" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium mb-2">Condition</h4>
                    <div className="space-y-2">
                      {["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"].map((condition) => (
                        <label key={condition} className="flex items-center space-x-2 text-base">
                          <input type="checkbox" className="rounded text-amber-500 focus:ring-amber-500 h-5 w-5" />
                          <span className="text-base">{condition}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-12 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-amber-100 text-amber-800 text-lg md:text-xl font-semibold mb-6">
              <Sparkles className="h-5 w-5 mr-1.5" />
              🤣🚢🔱🏴‍☠️☠️
            </div>
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Find the <span className="text-amber-600">One Piece!</span>
            </h2>

            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-7 w-7" />
                <Input
                  type="text"
                  placeholder="Search for One Piece cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-18 pl-16 pr-40 text-xl md:text-2xl border-2 border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all duration-200 shadow-lg"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {!!searchQuery && (
                    <Button type="button" variant="ghost" size="default" onClick={clearSearch} className="h-12 px-3">
                      <XCircle className="h-6 w-6" />
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-12 px-8 text-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {recentSearches.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <Badge variant="outline" className="px-3 py-1.5 text-base flex items-center gap-1">
                  <History className="h-4 w-4" />
                  Recent searches:
                </Badge>
                {recentSearches.map((q) => (
                  <Button 
                    key={q} 
                    variant="secondary" 
                    size="default" 
                    className="rounded-full text-base h-9" 
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
          <section className="py-12">
            <div className="grid gap-8 md:grid-cols-3">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                    <Search className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-3xl">Smart Search</CardTitle>
                  <CardDescription className="text-xl">
                    Find cards across multiple platforms with intelligent matching
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
                    <Coins className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-3xl">Live Conversion</CardTitle>
                  <CardDescription className="text-xl">
                    Automatic BRL to USD conversion with real-time exchange rates
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                    <BarChart3 className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                  </div>
                  <CardTitle className="text-3xl">Price Analysis</CardTitle>
                  <CardDescription className="text-xl">
                    Compare prices and find the best deals instantly
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>
        )}

        {hasSearched && (
          <section className="py-8">
            <nav className="flex items-center space-x-1 text-lg text-muted-foreground mb-6">
              <span>Home</span>
              <ChevronRight className="h-6 w-6" />
              <span>Search Results</span>
              <ChevronRight className="h-6 w-6" />
              <span className="text-foreground font-semibold">"{searchQuery}"</span>
            </nav>

            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">
                  {isSearching ? "Searching..." : "Search Results"}
                </h3>
                {!isSearching && (
                  <p className="text-xl text-muted-foreground">
                    Found {tcgResults.length + ligaResults.length} results for "{searchQuery}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur px-3 py-1.5">
                  1 USD = R$ {(1 / exchangeRate).toFixed(2)} BRL
                </Badge>

                <div className="flex items-center gap-1 border rounded-lg p-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="default"
                    onClick={() => setViewMode("grid")}
                    className="h-11 w-11 p-0"
                  >
                    <Grid className="h-6 w-6" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="default"
                    onClick={() => setViewMode("list")}
                    className="h-11 w-11 p-0"
                  >
                    <List className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>

            {isSearching ? (
              <div className="text-center py-16">
                <Loader2 className="w-20 h-20 mx-auto mb-4 animate-spin text-amber-500" />
                <p className="text-2xl text-muted-foreground">Searching both platforms...</p>
              </div>
            ) : (
              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-100 dark:bg-slate-800 p-1 text-lg">
                  <TabsTrigger 
                    value="comparison" 
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-700 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-amber-300 transition-all text-base md:text-lg"
                  >
                    Price Comparison
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tcgplayer" 
                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-300 transition-all text-base md:text-lg"
                  >
                    TCGPlayer
                    {tcgResults.length > 0 && <Badge variant="secondary" className="text-sm">{tcgResults.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="liga" 
                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-700 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-green-300 transition-all text-base md:text-lg"
                  >
                    Liga One Piece
                    {ligaResults.length > 0 && <Badge variant="secondary" className="text-sm">{ligaResults.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comparison" className="mt-8">
                  <PriceComparison
                    tcgResults={tcgResults}
                    ligaResults={ligaResults}
                    exchangeRate={exchangeRate || undefined}
                  />
                </TabsContent>

                <TabsContent value="tcgplayer" className="mt-8">
                  {searchErrors.tcg ? (
                    <div className="text-center py-16 text-destructive">
                      <p className="text-2xl">{searchErrors.tcg}</p>
                    </div>
                  ) : sortedTcg.length > 0 ? (
                    <div className="flex items-center justify-end mb-3 gap-2">
                      <SortButton
                        onClick={() => setTcgSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                        label={`Market · ${tcgSortDir.toUpperCase()}`}
                      />
                      <Button variant={tcgSortKey === "low" ? "default" : "outline"} size="default" onClick={() => setTcgSortKey("low")} className="text-base h-9">Low</Button>
                      <Button variant={tcgSortKey === "market" ? "default" : "outline"} size="default" onClick={() => setTcgSortKey("market")} className="text-base h-9">Market</Button>
                      <Button variant={tcgSortKey === "high" ? "default" : "outline"} size="default" onClick={() => setTcgSortKey("high")} className="text-base h-9">High</Button>
                    </div>
                    ) : null}

                  {sortedTcg.length > 0 ? (
                    <div className={viewMode === "grid" ? "grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                      {sortedTcg.map((card) => (
                        <Card
                          key={card.productId}
                          className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/70 group"
                        >
                          <div className="aspect-[3/4] bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 relative overflow-hidden">
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl || "/placeholder.svg"}
                                alt={card.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = `/placeholder.svg?height=400&width=300&query=${encodeURIComponent(card.name)}`
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <img
                                  src={`/abstract-geometric-shapes.png?key=e90nn&height=400&width=300&query=${encodeURIComponent(card.name)}`}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                            )}
                            <Badge className="absolute top-2 right-2 bg-blue-600 text-sm">TCGPlayer</Badge>
                          </div>
                          <CardContent className="p-6">
                            <h4 className="font-semibold text-foreground mb-3 line-clamp-2 text-xl md:text-2xl">{card.name}</h4>
                            {card.price && (
                              <div className="space-y-3 text-lg" style={{ fontFamily: '\"Roboto Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Market:</span>
                                  <div className="text-right">
                                    <div className="font-bold text-blue-600 dark:text-blue-400 text-xl">
                                      ${card.price.marketPrice?.toFixed(2) || "N/A"}
                                    </div>
                                    {card.price.marketPrice && (
                                      <div className="text-muted-foreground">
                                        R$ {convertUSDToBRL(card.price.marketPrice).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Low:</span>
                                  <div className="text-right">
                                    <div>${card.price.lowPrice?.toFixed(2) || "N/A"}</div>
                                    {card.price.lowPrice && (
                                      <div className="text-sm text-muted-foreground">
                                        R$ {convertUSDToBRL(card.price.lowPrice).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">High:</span>
                                  <div className="text-right">
                                    <div>${card.price.highPrice?.toFixed(2) || "N/A"}</div>
                                    {card.price.highPrice && (
                                      <div className="text-sm text-muted-foreground">
                                        R$ {convertUSDToBRL(card.price.highPrice).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            <Button variant="outline" size="default" className="w-full mt-5 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/20 text-base h-11" asChild>
                              <a href={card.url} target="_blank" rel="noopener noreferrer">
                                View on TCGPlayer
                                <ExternalLink className="w-5 h-5 ml-2" />
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <Search className="w-20 h-20 mx-auto mb-4 opacity-50" />
                      <p className="text-2xl">No TCGPlayer results found</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="liga" className="mt-8">
                  {searchErrors.liga ? (
                    <div className="text-center py-16 text-destructive">
                      <p className="text-2xl">{searchErrors.liga}</p>
                    </div>
                  ) : sortedLiga.length > 0 ? (
                    <>
                      <div className="flex items-center justify-end mb-3 gap-2">
                        <SortButton onClick={() => setLigaSortDir((d) => (d === "asc" ? "desc" : "asc"))} label={`Price · ${ligaSortDir.toUpperCase()}`} />
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                        {sortedLiga.map((card, index) => (
                          <Card
                            key={index}
                            className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/70 group"
                          >
                            <div className="aspect-[3/4] bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl || "/placeholder.svg"}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg?height=400&width=300&query=${encodeURIComponent(card.name)}`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <img
                                    src={`/abstract-geometric-shapes.png?key=hssux&height=400&width=300&query=${encodeURIComponent(card.name)}`}
                                    alt={card.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                              )}
                              <Badge className="absolute top-2 right-2 bg-green-600 text-sm">Liga One Piece</Badge>
                            </div>
                            <CardContent className="p-6">
                              <h4 className="font-semibold text-foreground mb-3 line-clamp-2 text-xl md:text-2xl">{card.name}</h4>
                              {card.price > 0 && (
                                <div className="space-y-3 text-lg" style={{ fontFamily: '\"Roboto Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}>
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Price:</span>
                                    <div className="text-right">
                                      <div className="font-bold text-green-600 dark:text-green-400 text-xl">
                                        {formatLigaPriceWithUSD(card.price, card.priceUSD)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Condition:</span>
                                    <span>{card.condition || "NM"}</span>
                                  </div>
                                </div>
                              )}
                              <Button variant="outline" size="default" className="w-full mt-5 bg-transparent hover:bg-green-50 dark:hover:bg-green-900/20 text-base h-11" asChild>
                                <a href={card.url} target="_blank" rel="noopener noreferrer">
                                  View on Liga One Piece
                                  <ExternalLink className="w-5 h-5 ml-2" />
                                </a>
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <Search className="w-20 h-20 mx-auto mb-4 opacity-50" />
                      <p className="text-2xl">No Liga One Piece results found</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </section>
        )}
      </main>

      <footer className="border-t bg-white/50 dark:bg-slate-950/50 backdrop-blur mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg shadow-md overflow-hidden">
                <img 
                src="/jollylupa.png" 
                alt="Jolly Lupa Logo" 
                className="h-full w-full object-cover"
                  />
                </div>
              <span className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                One Piece Comparator
              </span>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto">
              😊
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}