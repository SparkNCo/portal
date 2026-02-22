// @ts-nocheck
import { z } from "https://esm.sh/zod@3.23.8";

export const getClientDataQuerySchema = z.object({
  email: z.string().email(),
});

export const subscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  currentPeriodStart: z.number(),
  currentPeriodEnd: z.number(),
  cancelAtPeriodEnd: z.boolean(),
  price: z.any().optional(),
});

export const balanceSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  hasPendingBalance: z.boolean(),
});

export const invoiceSchema = z.object({
  id: z.string(),
  amountDue: z.number(),
  dueDate: z.number().nullable(),
  hostedInvoiceUrl: z.string().nullable(),
});

export const paymentMethodSchema = z.object({
  brand: z.string(),
  last4: z.string(),
  expMonth: z.number(),
  expYear: z.number(),
});

export const paymentMethodBodySchema = z.object({
  email: z.string().email(),
});

export const portalSessionSchema = z.object({
  url: z.string().url(),
});
