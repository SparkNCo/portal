import { Header } from "@/components/headerDashboard"
import { SettingsTabs } from "@/components/settings/settings-tabs"

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your project and account" subtitleClassName="smalltext" />

      <div className="p-4 md:p-6">
        <SettingsTabs />
      </div>
    </div>
  )
}
