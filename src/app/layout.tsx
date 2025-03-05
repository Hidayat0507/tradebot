import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navigation from "@/components/Navigation"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

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
        "page-background",
        inter.className
      )}>
        <Navigation />
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
