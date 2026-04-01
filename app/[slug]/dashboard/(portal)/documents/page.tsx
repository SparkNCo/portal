import { Header } from "@/components/headerDashboard"
import { DocumentsList } from "@/components/documents/documents-list"
import { UploadDocument } from "@/components/documents/upload-document"

export default function DocumentsPage() {
  return (
    <div className="min-h-screen">
      <Header title="Documents" subtitle="Artifacts, reports, and uploads" />

      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentsList />
          </div>
          <div>
            <UploadDocument />
          </div>
        </div>
      </div>
    </div>
  )
}
