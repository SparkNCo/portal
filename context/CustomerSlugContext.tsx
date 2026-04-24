"use client";
import { createContext, useContext } from "react";

const CustomerSlugContext = createContext<string | null>(null);
export const CustomerSlugProvider = CustomerSlugContext.Provider;
export const useCustomerSlug = () => useContext(CustomerSlugContext);
