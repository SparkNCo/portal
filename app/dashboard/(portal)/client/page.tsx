import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";

export default function ClientDashboard() {
  return (
    <div className="min-h-screen ">
      <Header title="Client Dashboard" subtitle="Welcome back, John" />

      <div className="p-4 md:p-6 space-y-6">
        {/*This used to be i n the line below :  h-[340px] */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr] ">
          <ProgressPieChart />
          <PriorityTasks />
        </div>
        <CreateIssue />
      </div>
    </div>
  );
}
