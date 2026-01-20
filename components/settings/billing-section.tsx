"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Download, DollarSign, Calendar } from "lucide-react"

const invoices = [
  { id: "INV-001", date: "Jan 1, 2025", amount: 15000, status: "paid" },
  { id: "INV-002", date: "Feb 1, 2025", amount: 15000, status: "paid" },
  { id: "INV-003", date: "Mar 1, 2025", amount: 18500, status: "pending" },
]

const statusColors = {
  paid: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  overdue: "bg-destructive/20 text-destructive",
}

export function BillingSection() {
  return (
    <div className="space-y-6">
      {/* Billing overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold text-card-foreground">$18,500</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                <DollarSign className="h-5 w-5 text-warning" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Due Mar 15, 2025</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Invoice Date</p>
                <p className="text-2xl font-bold text-card-foreground">Apr 1</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                <Calendar className="h-5 w-5 text-accent" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">~$15,000 estimated</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-accent" />
            Invoices
          </CardTitle>
          <Button variant="outline" size="sm" className="bg-transparent">
            Payment Methods
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{invoice.id}</p>
                    <p className="text-xs text-muted-foreground">{invoice.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-card-foreground">${invoice.amount.toLocaleString()}</span>
                  <Badge variant="secondary" className={statusColors[invoice.status as keyof typeof statusColors]}>
                    {invoice.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
