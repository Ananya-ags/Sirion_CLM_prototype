"use client";

import { initialStateFor } from "@/lib/requestFlow";
import type { SupplierView } from "@/lib/seed";
import type { Request } from "@/lib/types";
import { useDocketStore } from "@/store/useDocketStore";

/** Request for a supplier; before the store seeds, fall back to its initial state. */
export function useRequestMap(views: SupplierView[]): Record<string, Request> {
  const requests = useDocketStore((s) => s.requests);
  return Object.fromEntries(
    views.map((v) => {
      const id = `REQ-${v.supplierId}`;
      const fallback: Request = {
        id, supplier_id: v.supplierId, supplier_name: v.name, category: v.category, state: initialStateFor(v.lane),
        lane: v.lane, flags: v.flags, act_by: v.actBy?.actBy ?? null, internal_by: v.actBy?.decisionTarget ?? null,
        annual_value_inr: v.money.annualInr, owner: "owner", raised_at: "", updated_at: "",
      };
      return [v.supplierId, requests[id] ?? fallback];
    }),
  );
}
