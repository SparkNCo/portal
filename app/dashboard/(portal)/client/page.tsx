"use client";
import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { useEffect, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";

export default function ClientDashboard() {
  const [issuesData, setIssuesData] = useState([]);

  const searchParams = useSearchParams();
  const initiativeId = searchParams.get("id");

  const getIssuesData = async () => {
    const res = await fetch("/api/linear/issues");
    //const res = await fetch(`/api/linear/roadmap?initiativeId=${initiativeId}`);
    const issues = await res.json();
    console.log("issues", issues);
    if (issues?.projects?.nodes.length > 0) {
      setIssuesData(issues?.projects?.nodes);
    }
  };

  useEffect(() => {
    getIssuesData();
  }, []);

  return (
    <div className="min-h-screen ">
      <Header title="Client Dashboard" subtitle="Welcome back, John" />

      <div className="p-4 md:p-6 space-y-6">
        {/*This used to be i n the line below :  h-[340px] */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr] ">
          <CardTitle
            className="text-base font-semibold flex items-center gap-2"
            onClick={() => console.log(issuesData)}
          >
            Ver
          </CardTitle>
          <ProgressPieChart />
          <PriorityTasks />
        </div>
        <CreateIssue />
      </div>
    </div>
  );
}
