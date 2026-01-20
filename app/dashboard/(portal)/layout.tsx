import { Sidebar } from "@/components/sidebar"
import type React from "react"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-40">{children}</main>
    </div>
  )
}
