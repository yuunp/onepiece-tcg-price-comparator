import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'One Piece Compare',
  description: 'Compare One Piece card prices across platforms',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/jollylupawhitebg.png" />
        {/* Google Fonts - Inter and Geist Mono */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}