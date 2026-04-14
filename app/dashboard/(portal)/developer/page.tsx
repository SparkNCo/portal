import { Header } from "@/components/headerDashboard";
import { QuickLinks } from "@/components/developer/quick-links";
import { ToolShortcuts } from "@/components/developer/tool-shortcuts";
import { DevTasks } from "@/components/developer/dev-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { MetricsPanel } from "@/components/metrics/metrics-panel";

export default function DeveloperDashboard() {
  return (
    <div className="min-h-screen">
      <Header title="Developer Dashboard" subtitle="Good morning, Developer" />

      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <QuickLinks />
          <ToolShortcuts />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <CreateIssue />
          <DevTasks />
        </div>
      </div>
    </div>
  );
}
