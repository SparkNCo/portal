import { Header } from "@/components/headerDashboard"
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline"
import { VelocityMetrics } from "@/components/roadmap/velocity-metrics"
import { SoftwareKPIs } from "@/components/roadmap/software-kpis"

export default function RoadmapPage() {
  return (
    <div className="min-h-screen">
      <Header title="Roadmap" subtitle="Project timeline and progress" />

      <div className="p-6 space-y-6">
        <RoadmapTimeline />

        <div className="grid gap-6 lg:grid-cols-2">
          <VelocityMetrics />
          <SoftwareKPIs />
        </div>
      </div>
    </div>
  )
}
