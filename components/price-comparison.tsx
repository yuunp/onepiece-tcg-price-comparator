"use client"

import React, { useMemo } from "react"
import { ExternalLink, GitCompareArrows } from "lucide-react"
import { buildComparisonGroups, convertUsdToBrl, type CardEntry, type ComparisonGroup } from "@/lib/comparison"
import type { LigaCard } from "@/lib/liga"
import type { TCGPlayerCard } from "@/lib/tcgplayer"
import { getSafeSourceUrl } from "@/lib/source-url"

interface PriceComparisonProps { tcgResults: TCGPlayerCard[]; ligaResults: LigaCard[]; exchangeRate?: number }

export const PriceComparison = ({ tcgResults, ligaResults, exchangeRate = 0.19 }: PriceComparisonProps) => {
  const groups = useMemo(() => buildComparisonGroups(tcgResults, ligaResults, exchangeRate), [exchangeRate, ligaResults, tcgResults])
  const compared = groups.filter((g) => g.matchStatus === "exact")
  const identityReview = groups.filter((g) => g.matchStatus !== "exact")
  return (
    <div className="compare-workspace">
      <aside className="identity-rail">
        <div className="rail-label">IDENTITY INDEX</div>
        <div className="identity-count">{compared.length || groups.length}</div>
        <div className="rail-caption">card {compared.length ? "matches" : "groups"} found</div>
        <div className="rail-rule" />
        <div className="rail-key"><span className="dot dot-tcg" /> TCGPlayer</div>
        <div className="rail-key"><span className="dot dot-liga" /> Liga One Piece</div>
        <p className="rail-note">Compare like-for-like identity first. Variant and condition stay attached to each listing.</p>
        <div className="rail-legend"><span>FX</span><small>USD converted using the reported rate. Verify at source.</small></div>
      </aside>
      <div className="compare-feed">
        <div className="workspace-intro">
          <div><div className="eyebrow">MATCH WORKSPACE</div><h2>Source lanes</h2></div>
          <p>{compared.length ? `${compared.length} identity match${compared.length === 1 ? "" : "es"} with both sources returned.` : "No cross-source identity matches in this response."}</p>
        </div>
        {compared.length ? compared.map((group) => <GroupCard key={group.groupKey} group={group} exchangeRate={exchangeRate} />) : <div className="compare-empty"><GitCompareArrows /><strong>Comparison needs two returned sources</strong><span>Inspect the source tabs for the listings that did return. Non-verified groups are kept below for identity review.</span></div>}
        {identityReview.length > 0 && <section className="unmatched-block"><div className="eyebrow">IDENTITY REVIEW · {identityReview.length}</div><h3>Listings not verified for comparison</h3><p className="section-copy">These listings stay visible, but prices are not compared until their identity is complete and agrees across sources.</p>{identityReview.map((group) => <GroupCard key={group.groupKey} group={group} exchangeRate={exchangeRate} compact />)}</section>}
      </div>
    </div>
  )
}

function GroupCard({ group, exchangeRate, compact = false }: { group: ComparisonGroup; exchangeRate: number; compact?: boolean }) {
  const code = group.subtitle || "Identity details incomplete"
  const statusLabel = group.matchStatus === "exact" ? "VERIFIED IDENTITY" : group.matchStatus === "ambiguous" ? "NEEDS IDENTITY REVIEW" : "NO VERIFIED COUNTERPART"
  return <article className={`match-card ${compact ? "match-card-compact" : ""}`}>
    <header className="match-card-head"><div><div className={`match-status ${group.matchStatus === "exact" ? "is-matched" : "is-unmatched"}`}>{statusLabel}</div><h3>{group.title}</h3><p>{code} <span>·</span> {group.entries.length} listing{group.entries.length === 1 ? "" : "s"}</p></div>{group.matchStatus === "exact" ? <div className="match-spread">{group.bestPrice === "tie" ? "Price tie" : group.bestPrice === "tcg" ? "TCGPlayer lower" : "Liga lower"}</div> : <div className="match-spread">Not compared</div>}</header>
    <p className="match-evidence">{group.evidence.join(" · ")}</p>
    <div className="source-lanes"><SourceLane label="TCGPlayer" kind="tcg" entries={group.tcgEntries} exchangeRate={exchangeRate} /><SourceLane label="Liga One Piece" kind="liga" entries={group.ligaEntries} exchangeRate={exchangeRate} /></div>
  </article>
}

function SourceLane({ label, kind, entries, exchangeRate }: { label: string; kind: "tcg" | "liga"; entries: CardEntry[]; exchangeRate: number }) {
  return <section className={`source-lane lane-${kind}`}><div className="lane-head"><span><i className="dot" />{label}</span><b>{entries.length ? `${entries.length} found` : "Unavailable"}</b></div>{entries.length ? <div className="lane-list">{entries.map((entry) => <Listing key={entry.id} entry={entry} exchangeRate={exchangeRate} />)}</div> : <div className="lane-unavailable"><strong>No returned counterpart</strong><span>This source did not provide a listing for this identity.</span></div>}</section>
}

function Listing({ entry, exchangeRate }: { entry: CardEntry; exchangeRate: number }) {
  const card = entry.tcgCard || entry.ligaCard
  if (!card) return null
  const imageUrl = "imageUrl" in card ? card.imageUrl : undefined
  const href = "url" in card ? getSafeSourceUrl(card.url) : null
  const hasPrice = entry.platform === "tcg" ? entry.tcgCard?.price?.marketPrice != null : entry.ligaCard?.price != null
  const primary = entry.platform === "tcg" ? formatCurrency(entry.usdPrice, "USD") : formatCurrency(entry.brlPrice, "BRL")
  const secondary = entry.platform === "tcg" ? `≈ ${formatCurrency(convertUsdToBrl(entry.usdPrice, exchangeRate), "BRL")}` : `≈ ${formatCurrency(entry.usdPrice, "USD")}`
  const variant = entry.variantTokens.length ? entry.variantTokens.join(" · ") : entry.identity.variant === "base" ? "Base" : "Unknown variant"
  const condition = entry.platform === "liga" ? entry.ligaCard?.condition?.trim() || "Not provided" : "Not provided"
  return <div className="listing-row"><div className="listing-thumb">{imageUrl ? <img src={imageUrl} alt={entry.displayName} onError={(e) => { if (!e.currentTarget.src.endsWith("/placeholder.svg")) e.currentTarget.src = "/placeholder.svg" }} /> : <img src="/placeholder.svg" alt="No card image available" />}</div><div className="listing-main"><strong>{card.name}</strong><span>{entry.setName || "Set not provided"}</span><span>{variant} <em>·</em> Condition: {condition}</span></div><div className="listing-price"><strong>{hasPrice ? primary : "Price unavailable"}</strong>{hasPrice && <span>{secondary}</span>}{href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${card.name} on ${entry.platform === "tcg" ? "TCGPlayer" : "Liga One Piece"}`}>Open source <ExternalLink /></a> : <span className="no-source">Source unavailable</span>}</div></div>
}

function formatCurrency(amount: number, currency: "USD" | "BRL") { return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency }).format(amount) }
