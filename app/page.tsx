"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  ExternalLink,
  Loader2,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ArrowRight,
  Layers,
  RefreshCw,
  TrendingDown,
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
      } catch { }
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ========== NAVBAR ========== */}
      <nav className="sticky top-0 z-50 glass border-b border-border transition-all">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-5">
          <button onClick={clearSearch} className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-full overflow-hidden border border-border group-hover:border-primary transition-all duration-300 shadow-[0_0_12px_rgba(129,140,248,0.15)] group-hover:shadow-[0_0_20px_rgba(129,140,248,0.4)]">
              <img src="/jollylupa.png" alt="One Piece Compare logo" className="h-full w-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <span className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                BountyDex
              </span>
            </div>
          </button>

          <div className="flex items-center gap-4">
            {hasSearched && (
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground glass px-3 py-1.5 rounded-full">
                <RefreshCw className="h-3 w-3" />
                <span className="font-mono">1 USD = R$ {(1 / exchangeRate).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-primary font-medium glass px-3 py-1.5 rounded-full border border-primary/20">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.6)]" />
              <span className="hidden sm:inline">Live Sync</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ========== HERO / LANDING ========== */}
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center px-5 py-24 md:py-36 relative overflow-hidden">
            {/* Ambient background glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl animate-fade-up relative z-10">
              {/* Logo mark */}
              <div className="flex justify-center mb-12 relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
                <div className="h-24 w-24 rounded-2xl overflow-hidden glass shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-primary/20 relative z-10 transition-transform hover:scale-105 duration-300 ring-4 ring-background">
                  <img src="/jollylupa.png" alt="Logo" className="h-full w-full object-cover" />
                </div>
              </div>

              <h1 className="text-5xl md:text-7xl font-extrabold text-center text-foreground tracking-tighter leading-[1.1] text-balance drop-shadow-sm">
                Bounty<span className="text-primary [-webkit-text-stroke:1px_rgba(129,140,248,0.2)]">Dex</span>
                <br />
                <span className="text-3xl md:text-4xl text-muted-foreground font-medium mt-4 block tracking-tight">
                  Cross-Platform Market Intelligence
                </span>
              </h1>

              <p className="text-center text-muted-foreground mt-6 text-lg leading-relaxed max-w-xl mx-auto">
                Instantly compare prices across <span className="text-blue-400 font-semibold">TCGPlayer</span> & <span className="text-emerald-400 font-semibold">Liga One Piece</span> to find the perfect deals.
              </p>

              {/* Search */}
              <form onSubmit={handleSearch} className="mt-12 group">
                <div className="relative glass-panel rounded-2xl p-2 transition-all duration-300 focus-within:shadow-[0_0_30px_rgba(129,140,248,0.2)] focus-within:border-primary/40 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="text"
                      placeholder="Enter card name, code, or character..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 pl-12 pr-10 text-base bg-transparent border-0 focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground/70"
                    />
                    {!!searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-14 px-8 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(129,140,248,0.4)] transition-all overflow-hidden relative"
                  >
                    {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> :
                      <span className="flex items-center gap-2 relative z-10 text-sm tracking-wide">
                        SEARCH <Search className="h-4 w-4" />
                      </span>
                    }
                  </Button>
                </div>
              </form>

              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-2.5 justify-center items-center">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {recentSearches.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setSearchQuery(q); setTimeout(() => handleSearch(), 0) }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium glass hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-300 shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-4 mt-20 justify-center stagger relative z-10">
              {[
                { icon: Layers, label: "Multi-platform indexing" },
                { icon: TrendingDown, label: "Intelligent price matching" },
                { icon: RefreshCw, label: "Live currency rates" },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-5 py-3 rounded-full glass border border-border text-sm font-medium text-foreground hover:border-primary/30 hover:shadow-[0_0_15px_rgba(129,140,248,0.1)] transition-all cursor-default"
                >
                  <f.icon className="h-4 w-4 text-primary" />
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ========== RESULTS ========== */
          <div className="max-w-6xl mx-auto px-5 py-8">
            {/* Inline search bar */}
            <form onSubmit={handleSearch} className="mb-10 animate-fade-up">
              <div className="flex items-center gap-2 max-w-2xl mx-auto md:mx-0">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="text"
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-11 pr-10 text-sm glass border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 transition-all shadow-sm group-focus-within:shadow-[0_0_15px_rgba(129,140,248,0.15)]"
                  />
                  {!!searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="h-12 px-6 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-[0_0_15px_rgba(129,140,248,0.3)] transition-all"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "SEARCH"}
                </Button>
              </div>
            </form>

            {/* Breadcrumb + summary */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2" aria-label="Breadcrumb">
                  <button onClick={clearSearch} className="hover:text-primary transition-colors">Home</button>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">{searchQuery}</span>
                </nav>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {isSearching ? "Searching..." : `${totalResults} results`}
                </h2>
              </div>

              {!isSearching && (
                <div className="flex items-center gap-1.5 p-1.5 glass rounded-xl border border-border/50">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all ${viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="sr-only">Grid view</span>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                  >
                    <List className="h-4 w-4" />
                    <span className="sr-only">List view</span>
                  </button>
                </div>
              )}
            </div>

            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground mt-6">Searching both platforms...</p>
                <p className="text-xs text-muted-foreground mt-1">Comparing prices in real-time</p>
              </div>
            ) : (
              <Tabs defaultValue="comparison" className="w-full animate-fade-up">
                <TabsList className="w-full grid grid-cols-3 h-14 glass border border-border/50 rounded-2xl p-1.5">
                  <TabsTrigger
                    value="comparison"
                    className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
                  >
                    Comparison
                  </TabsTrigger>
                  <TabsTrigger
                    value="tcgplayer"
                    className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
                  >
                    TCGPlayer
                    {tcgResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-5 bg-background/50 border-none">{tcgResults.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="liga"
                    className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
                  >
                    Liga O.P.
                    {ligaResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-5 bg-background/50 border-none">{ligaResults.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* COMPARISON TAB */}
                <TabsContent value="comparison" className="mt-8">
                  <PriceComparison
                    tcgResults={tcgResults}
                    ligaResults={ligaResults}
                    exchangeRate={exchangeRate || undefined}
                  />
                </TabsContent>

                {/* TCGPLAYER TAB */}
                <TabsContent value="tcgplayer" className="mt-8">
                  {searchErrors.tcg ? (
                    <div className="flex items-center justify-center py-20 text-destructive gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm">{searchErrors.tcg}</p>
                    </div>
                  ) : sortedTcg.length > 0 ? (
                    <>
                      {/* Sort controls */}
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <span className="text-xs text-muted-foreground font-medium">Sort by:</span>
                        {(["market", "low", "high"] as const).map((key) => (
                          <button
                            key={key}
                            onClick={() => setTcgSortKey(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tcgSortKey === key
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-secondary text-secondary-foreground hover:text-foreground border border-border"
                              }`}
                          >
                            {key === "market" ? "Market" : key === "low" ? "Low" : "High"}
                          </button>
                        ))}
                        <button
                          onClick={() => setTcgSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:text-foreground border border-border transition-all flex items-center gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {tcgSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}>
                        {sortedTcg.map((card, index) => (
                          <div
                            key={card.productId || index}
                            className="glass border border-border/50 rounded-2xl overflow-hidden card-hover group"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="aspect-[3/4] bg-secondary/30 relative overflow-hidden p-2">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] group-hover:scale-[1.05] group-hover:-translate-y-2 transition-all duration-500 ease-out"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-secondary/50 rounded-xl border border-dashed border-border">
                                  <span className="text-xs text-muted-foreground font-medium">No Image</span>
                                </div>
                              )}
                              <span className="absolute top-3 right-3 platform-tcg text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md">
                                TCGPlayer
                              </span>
                            </div>
                            <div className="p-5 border-t border-border/30 bg-card/40">
                              <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-4 group-hover:text-blue-400 transition-colors">{card.name}</h4>
                              {card.price && (
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-muted-foreground">Market</span>
                                  <div className="text-right">
                                    <span className="text-lg font-bold text-foreground font-mono">
                                      ${card.price.marketPrice?.toFixed(2) || "N/A"}
                                    </span>
                                    {card.price.marketPrice && (
                                      <p className="text-[11px] text-muted-foreground font-mono">
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
                                className="mt-5 flex items-center justify-center gap-2 w-full h-10 rounded-xl text-xs font-bold border border-border/50 bg-secondary/50 text-foreground hover:bg-[#2563eb] hover:text-white hover:border-[#2563eb] hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all duration-300"
                              >
                                View on TCGPlayer
                                <ExternalLink className="h-4 w-4" />
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
                <TabsContent value="liga" className="mt-8">
                  {searchErrors.liga ? (
                    <div className="flex items-center justify-center py-20 text-destructive gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm">{searchErrors.liga}</p>
                    </div>
                  ) : sortedLiga.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <span className="text-xs text-muted-foreground font-medium">Sort:</span>
                        <button
                          onClick={() => setLigaSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground transition-all flex items-center gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          {ligaSortDir === "asc" ? "Low to High" : "High to Low"}
                        </button>
                      </div>

                      <div className={viewMode === "grid" ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}>
                        {sortedLiga.map((card, index) => (
                          <div
                            key={index}
                            className="glass border border-border/50 rounded-2xl overflow-hidden card-hover group"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="aspect-[3/4] bg-secondary/30 relative overflow-hidden p-2">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] group-hover:scale-[1.05] group-hover:-translate-y-2 transition-all duration-500 ease-out"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = `/placeholder.svg`
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-secondary/50 rounded-xl border border-dashed border-border">
                                  <span className="text-xs text-muted-foreground font-medium">No Image</span>
                                </div>
                              )}
                              <span className="absolute top-3 right-3 platform-liga text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md">
                                Liga One Piece
                              </span>
                            </div>
                            <div className="p-5 border-t border-border/30 bg-card/40">
                              <h4 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-4 group-hover:text-emerald-400 transition-colors">{card.name}</h4>
                              {card.price > 0 && (
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-muted-foreground">Price</span>
                                  <span className="text-lg font-bold text-foreground font-mono">
                                    {formatLigaPriceWithUSD(card.price, card.priceUSD)}
                                  </span>
                                </div>
                              )}
                              <a
                                href={card.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 flex items-center justify-center gap-2 w-full h-10 rounded-xl text-xs font-bold border border-border/50 bg-secondary/50 text-foreground hover:bg-[#059669] hover:text-white hover:border-[#059669] hover:shadow-[0_0_15px_rgba(5,150,105,0.4)] transition-all duration-300"
                              >
                                View on Liga
                                <ExternalLink className="h-4 w-4" />
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
      <footer className="border-t border-border mt-auto glass">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <button
            onClick={() => { clearSearch(); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            className="flex items-center gap-2 group"
          >
            <div className="h-8 w-8 rounded-full overflow-hidden border border-border group-hover:border-primary transition-all duration-300 group-hover:shadow-[0_0_12px_rgba(129,140,248,0.3)]">
              <img src="/jollylupa.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
              BountyDex
            </span>
          </button>
          <div className="flex flex-col items-center md:items-end gap-1">
            <p className="text-xs text-muted-foreground font-medium">
               <span className="text-destructive animate-pulse"></span> 
            </p>
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              Not affiliated with Bandai or Toei Animation
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 animate-fade-up">
      <div className="h-16 w-16 rounded-3xl glass border border-border/50 flex items-center justify-center mb-6 shadow-sm">
        <Search className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-base text-foreground font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-2">Try adjusting your search terms</p>
    </div>
  )
}
