import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'Harness Coach',
  description: 'AI-powered Claude Code harness diagnostics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }} afterSignOutUrl="/sign-in">
      <html lang="ko" className="dark">
        <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-background text-foreground`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
