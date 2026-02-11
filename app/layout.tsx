import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'One Piece Compare — Card Price Comparison',
  description: 'Compare One Piece TCG card prices across TCGPlayer and Liga One Piece in real-time.',
}

export const viewport: Viewport = {
  themeColor: '#0c0c0e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/jollylupawhitebg.png" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
