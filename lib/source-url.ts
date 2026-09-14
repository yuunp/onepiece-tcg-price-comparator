const SOURCE_HOSTS = ["tcgplayer.com", "ligaonepiece.com.br"] as const

function isExpectedHost(hostname: string, expectedHosts: readonly string[]): boolean {
  return expectedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

export function getSafeSourceUrl(value: string | null | undefined, expectedHosts: readonly string[] = SOURCE_HOSTS): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    if (!isExpectedHost(url.hostname.toLowerCase(), expectedHosts)) return null
    return url.toString()
  } catch {
    return null
  }
}