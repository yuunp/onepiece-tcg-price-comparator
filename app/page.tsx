"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  ExternalLink,
  Loader2,
  LayoutGrid,
  List,
  X,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ArrowRight,
  Zap,
  Globe,
  TrendingDown,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      // fallback rate
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

  const totalResults = tcgResults.length + ligaResults.length

  /* ================================================================ */

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 md:px-6">
          <button onClick={clearSearch} className="flex items-center gap-2.5 group">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden ring-1 ring-border group-hover:ring-primary/50 transition-all">
              <img src="/jollylupa.png" alt="One Piece Compare logo" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight hidden sm:inline group-hover:text-primary transition-colors">
              OPCompare
            </span>
          </button>

          <div className="flex items-center gap-5">
            {hasSearched && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 text-xs text-muted-foreground font-mono">
                <Globe className="h-3 w-3 text-primary" />
                1 USD = R$ {(1 / exchangeRate).toFixed(2)}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="hidden sm:inline font-medium">Live prices</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ========== HERO / LANDING ========== */}
        {!hasSearched ? (
          <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 hero-gradient overflow-hidden">
            {/* Decorative orb */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-2xl animate-hero-in">
              {/* Logo + badge */}
              <div className="flex flex-col items-center gap-5 mb-8">
                <div className="relative">
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl overflow-hidden ring-1 ring-border animate-pulse-glow">
                    <img src="/jollylupa.png" alt="Logo" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span>Searching 2 platforms simultaneously</span>
                </div>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-center tracking-tight leading-[0.95] text-balance">
                <span className="text-foreground">Find the</span>
                <br />
                <span className="bg-gradient-to-r from-primary via-emerald-400 to-primary bg-clip-text text-transparent">
                  best price
                </span>
              </h1>

              <p className="text-center text-muted-foreground mt-5 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
                Compare One Piece TCG card prices across TCGPlayer and
                Liga One Piece. Instant results, real-time exchange rates.
              </p>

              {/* Search bar */}
              <form onSubmit={handleSearch} className="mt-10">
                <div className="relative glass rounded-2xl p-1.5 glow-border">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search any card... (e.g. Luffy, OP06-001)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-13 md:h-14 pl-12 pr-10 text-sm md:text-base bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      {!!searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="h-11 md:h-12 px-5 md:px-7 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm md:text-base shrink-0"
                    >
                      {isSearching ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Search
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 justify-center items-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <Clock className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  {recentSearches.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setSearchQuery(q); setTimeout(() => handleSearch(), 0) }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium glass text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom feature strip */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-border/50">
              <div className="max-w-7xl mx-auto grid grid-cols-3 divide-x divide-border/50">
                {[
                  { icon: Zap, title: "Instant", desc: "Real-time search" },
                  { icon: TrendingDown, title: "Best Deals", desc: "Auto price match" },
                  { icon: Globe, title: "BRL / USD", desc: "Live rates" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center justify-center gap-3 py-4 md:py-5 px-3">
                    <f.icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="hidden sm:block">
                      <div className="text-xs font-semibold text-foreground">{f.title}</div>
                      <div className="text-[11px] text-muted-foreground">{f.desc}</div>
                    </div>
                    <span className="sm:hidden text-xs font-medium text-muted-foreground">{f.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ========== RESULTS VIEW ========== */
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 animate-fade-in">
            {/* Top bar: search + controls */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative glass rounded-xl p-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search cards..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 pl-10 pr-10 text-sm bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      {!!searchQuery && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      size="sm"
                      className="rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4"
                    >
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                    </Button>
                  </div>
                </div>
              </form>

              <div className="flex items-center gap-3">
                {/* Result count */}
                <div className="text-sm text-muted-foreground">
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Searching...
                    </span>
                  ) : (
                    <span>
                      <span className="font-bold text-foreground">{totalResults}</span> results for{" "}
                      <span className="font-semibold text-foreground">{`"${searchQuery}"`}</span>
                    </span>
                  )}
                </div>

                {/* View toggle */}
                {!isSearching && (
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg glass">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`flex items-center justify-center h-8 w-8 rounded-md transition-all ${
                        viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="sr-only">Grid view</span>
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center justify-center h-8 w-8 rounded-md transition-all ${
                        viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <List className="h-3.5 w-3.5" />
                      <span className="sr-only">List view</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
                <div className="relative h-16 w-16 rounded-2xl glass flex items-center justify-center animate-pulse-glow">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground mt-6">Searching both platforms</p>
                <p className="text-xs text-muted-foreground mt-1.5">Comparing prices across TCGPlayer & Liga One Piece</p>
              </div>
            ) : (
              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="w-full grid grid-cols-3 h-11 glass rounded-xl p-1 mb-8">
                  <TabsTrigger
                    value="comparison"
                    className="rounded-lg text-xs md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    Comparison
                  </TabsTrigger>
                  <TabsTrigger
                    value="tcgplayer"
                    className="rounded-lg text-xs md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    TCGPlayer
                    {tcgResults.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-mono opacity-70">({tcgResults.length})</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="liga"
                    className="rounded-lg text-xs md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    Liga
                    {ligaResults.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-mono opacity-70">({ligaResults.length})</span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* COMPARISON TAB */}
                <TabsContent value="comparison">
                  <PriceComparison
                    tcgResults={tcgResults}
                    ligaResults={ligaResults}
                    exchangeRate={exchangeRate || undefined}
                  />
                </TabsContent>

                {/* TCGPLAYER TAB */}
                <TabsContent value="tcgplayer">
                  {searchErrors.tcg ? (
                    <div className="flex items-center justify-center py-20 gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-destructive">{searchErrors.tcg}</p>
                    </div>
                  ) : sortedTcg.length > 0 ? (
                    <>
                      {/* Sort controls */}
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sort</span>
                        <div className="h-3 w-px bg-border" />
                        {(["market", "low", "high"] as const).map((key) => (
                          <button
                            key={key}
                            onClick={() => setTcgSortKey(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              tcgSortKey === key
                                ? "bg-primary text-primary-foreground"
                                : "glass text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {key === "market" ? "Market" : key === "low" ? "Low" : "High"}
                          </button>
                        ))}
                        <button
                          onClick={() => setTcgSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold glass text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {tcgSortDir === "asc" ? "Lowest" : "Highest"}
                        </button>
                      </div>

                      <div className={
                        viewMode === "grid"
                          ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger"
                          : "flex flex-col gap-3 stagger"
                      }>
                        {sortedTcg.map((card) => (
                          <div
                            key={card.productId}
                            className="bg-card rounded-xl overflow-hidden border border-border card-lift group"
                          >
                            <div className="aspect-[3/4] bg-secondary/30 relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
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
                              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
                              <span className="absolute top-3 right-3 tag-tcg text-[10px] font-bold px-2.5 py-1 rounded-full">
                                TCGPlayer
                              </span>
                            </div>
                            <div className="p-4">
                              <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-3">{card.name}</h4>
                              {card.price && (
                                <div className="flex items-end justify-between">
                                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Market</span>
                                  <div className="text-right">
                                    <span className="text-xl font-black text-foreground font-mono tabular-nums">
                                      ${card.price.marketPrice?.toFixed(2) || "N/A"}
                                    </span>
                                    {card.price.marketPrice && (
                                      <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                                        R$ {convertUSDToBRL(card.price.marketPrice).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              <a
                                href={card.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 flex items-center justify-center gap-2 w-full h-9 rounded-lg text-xs font-bold glass text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                              >
                                View on TCGPlayer
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState message="No results found on TCGPlayer" />
                  )}
                </TabsContent>

                {/* LIGA TAB */}
                <TabsContent value="liga">
                  {searchErrors.liga ? (
                    <div className="flex items-center justify-center py-20 gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-destructive">{searchErrors.liga}</p>
                    </div>
                  ) : sortedLiga.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sort</span>
                        <div className="h-3 w-px bg-border" />
                        <button
                          onClick={() => setLigaSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground transition-all flex items-center gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {ligaSortDir === "asc" ? "Lowest" : "Highest"}
                        </button>
                      </div>

                      <div className={
                        viewMode === "grid"
                          ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger"
                          : "flex flex-col gap-3 stagger"
                      }>
                        {sortedLiga.map((card, index) => (
                          <div
                            key={index}
                            className="bg-card rounded-xl overflow-hidden border border-border card-lift group"
                          >
                            <div className="aspect-[3/4] bg-secondary/30 relative overflow-hidden">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
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
                              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
                              <span className="absolute top-3 right-3 tag-liga text-[10px] font-bold px-2.5 py-1 rounded-full">
                                Liga One Piece
                              </span>
                            </div>
                            <div className="p-4">
                              <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-3">{card.name}</h4>
                              {card.price > 0 && (
                                <div className="flex items-end justify-between">
                                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Price</span>
                                  <span className="text-xl font-black text-foreground font-mono tabular-nums">
                                    {formatLigaPriceWithUSD(card.price, card.priceUSD)}
                                  </span>
                                </div>
                              )}
                              <a
                                href={card.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 flex items-center justify-center gap-2 w-full h-9 rounded-lg text-xs font-bold glass text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                              >
                                View on Liga
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState message="No results found on Liga One Piece" />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => { clearSearch(); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            className="flex items-center gap-2 group"
          >
            <div className="h-5 w-5 rounded-md overflow-hidden ring-1 ring-border group-hover:ring-primary/50 transition-all">
              <img src="/jollylupa.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
              OPCompare
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground">
            Prices sourced from TCGPlayer & Liga One Piece. Not affiliated with Bandai.
          </p>
        </div>
      </footer>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 animate-fade-in">
      <div className="h-16 w-16 rounded-2xl glass flex items-center justify-center mb-4">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground font-semibold">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
    </div>
  )
}
