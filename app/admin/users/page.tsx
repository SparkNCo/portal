"use client";

import { useState } from "react";
import { useUser } from "../../../context/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AddDeveloperModal from "./AddDeveloperModal";
import AddClientModal from "./AddClientModal";
import AssignCustomerModal from "./AssignCustomerModal";

type User = {
  id: string;
  email: string;
  role: "admin" | "developer" | "customer";
};

export default function AdminUsersPage() {
  const { user, profile, loading } = useUser();
  const queryClient = useQueryClient();

  const [showAddDevModal, setShowAddDevModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  // ✅ Fetch ALL users
  const {
    data: users = [],
    isLoading: usersLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/users`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch users");

      return res.json();
    },
  });

  // ✅ Get ONLY customers from users
  const customers = users.filter((u: User) => u.role === "customer");

  // ✅ Assign mutation
  const { mutate: assignUser, isPending: assigning } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: assigningUserId,
            customer_id: selectedCustomer,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to assign user");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setAssigningUserId(null);
      setSelectedCustomer("");
    },
  });

  // =========================
  // STATES
  // =========================

  if (loading || !profile?.role) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (profile.role !== "admin") {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        Not authorized
      </div>
    );
  }

  if (usersLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500">
        Error loading users
      </div>
    );
  }

  // =========================
  // UI
  // =========================

  return (
    <div className="p-6 space-y-6">
      {showAddDevModal && (
        <AddDeveloperModal onClose={() => setShowAddDevModal(false)} />
      )}

      {showAddCustomerModal && (
        <AddClientModal onClose={() => setShowAddCustomerModal(false)} />
      )}

      <h1 className="text-2xl font-bold">Admin - Users</h1>

      <div className="text-white">{user?.email}</div>

      <div
        className="text-white cursor-pointer"
        onClick={() => console.log({ user, profile, users })}
      >
        VIEW USER
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={() => setShowAddDevModal(true)}
        >
          Add Developer
        </button>

        <button
          className="border px-4 py-2 rounded"
          onClick={() => setShowAddCustomerModal(true)}
        >
          Add Client
        </button>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u: User) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>

              <td className="p-2">
                {u.role === "developer" && (
                  <button
                    className="bg-blue-500 text-white px-3 py-1 rounded"
                    onClick={() => setAssigningUserId(u.id)}
                  >
                    Assign to Customer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Assign Modal */}
      {assigningUserId && (
        <AssignCustomerModal
          userId={assigningUserId}
          customers={customers}
          onClose={() => setAssigningUserId(null)}
        />
      )}
    </div>
  );
}
