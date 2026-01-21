"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { VelocityMetrics } from "@/components/roadmap/velocity-metrics";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CardTitle } from "@/components/ui/card";

export default function RoadmapPage() {
  const searchParams = useSearchParams();
  const initiativeId = searchParams.get("id");

  const [roadMapData, setRoadMapData] = useState([]);

  const getRoadMapData = async () => {
    console.log("triggered");

    const res = await fetch(`/api/linear/roadmap?initiativeId=${initiativeId}`);
    const issues = await res.json();
    console.log("roadmap", issues);
    if (issues?.projects?.nodes.length > 0) {
      setRoadMapData(issues?.projects?.nodes[1]);
    }
  };

  useEffect(() => {
    getRoadMapData();
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="Roadmap" subtitle="Project timeline and progress" />

      <div className="p-6 space-y-6">
        <CardTitle
          className="text-base font-semibold flex items-center gap-2"
          onClick={() => console.log(roadMapData)}
        >
          Ver
        </CardTitle>
        <RoadmapTimeline
          projectName={roadMapData?.name}
          projectMilestones={roadMapData?.projectMilestones?.nodes}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <VelocityMetrics />
          <SoftwareKPIs
            targetDate={roadMapData?.targetDate}
            progress={roadMapData?.progress}
          />
        </div>
      </div>
    </div>
  );
}
