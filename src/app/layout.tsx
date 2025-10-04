import type { Metadata } from "next"
import "./globals.css"
import ConditionalNavigation from "@/components/ConditionalNavigation"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Trading Bot",
  description: "TradingView to Crypto Exchange Bot",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={cn(
        "page-background font-sans"
      )}>
        <ConditionalNavigation />
        <main className="relative min-h-screen">
          {/* Background with blur */}
          <div 
            className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.gray.100),theme(colors.gray.50))] dark:bg-[radial-gradient(45rem_50rem_at_top,theme(colors.gray.800),theme(colors.gray.900))] opacity-50"
            aria-hidden="true"
          />
          
          {/* Content */}
          <div className="relative isolate">
            {children}
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  )
}
