"use client";
import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { useEffect, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { LoadingDataPanel } from "@/components/loader";

export default function ClientDashboard() {
  const [issuesData, setIssuesData] = useState([]);
  const [loading, setLoadings] = useState(true);

  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const getIssuesData = async () => {
    const res = await fetch(`/api/linear/issues?projectId=${projectId}`);
    const issues = await res.json();
    if (issues) {
      setIssuesData(issues);
    }
    setLoadings(false);
  };

  useEffect(() => {
    getIssuesData();
  }, []);

  return (
    <div className="min-h-screen ">
      <Header title="Client Dashboard" subtitle="Welcome back, John" />
      {loading ? (
        <LoadingDataPanel />
      ) : (
        <div className="p-4 md:p-6 space-y-6">
          {/*This used to be i n the line below :  h-[340px] */}
          <CardTitle
            className="text-base font-semibold flex items-center gap-2"
            onClick={() => console.log(issuesData)}
          >
            Ver issuesData
          </CardTitle>

          <div className="grid gap-4 md:gap-6 grid-cols-1  md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr] ">
            <ProgressPieChart issuesData={issuesData} />
            <PriorityTasks issuesData={issuesData} />
          </div>
          <CreateIssue />
        </div>
      )}
    </div>
  );
}
