import { Header } from "@/components/headerDashboard"
import { SettingsTabs } from "@/components/settings/settings-tabs"

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your project and account" />

      <div className="p-6">
        <SettingsTabs />
      </div>
    </div>
  )
}
