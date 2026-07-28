"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "context/UserContext";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import AdminUsersPage from "@/app/admin/users/page";

export default function AdminPage() {
  const { profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.role !== "admin") {
      router.replace("./dashboard");
    }
  }, [loading, profile, router]);

  if (loading) return <LoadingDataPanel />;
  if (profile?.role !== "admin") return null;

  return (
    <div className="min-h-screen">
      <Header title="Admin Panel" subtitle="Manage users and settings" />

      <div className="p-4 md:p-6">
        <AdminUsersPage />
      </div>
    </div>
  );
}
