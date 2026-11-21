/**
 * Docket's supplier register: the IDs the app uses for each supplier relationship it tracks, keyed by
 * the vendor master's vendor_id. In production this is the supplier table Docket keeps itself.
 * The AI pipeline groups documents to a vendor_id (from vendor_master.csv) and this register turns
 * that into the app's supplier_id. It is NOT read from dev_gold.json (gold is evals-only).
 */
export const SUPPLIER_REGISTER: { supplier_id: string; vendor_id: string }[] = [
  { supplier_id: "SUP-01", vendor_id: "V-10041" },
  { supplier_id: "SUP-02", vendor_id: "V-10057" },
  { supplier_id: "SUP-03", vendor_id: "V-10012" },
  { supplier_id: "SUP-04", vendor_id: "V-10008" },
  { supplier_id: "SUP-05", vendor_id: "V-10066" },
  { supplier_id: "SUP-06", vendor_id: "V-10071" },
  { supplier_id: "SUP-07", vendor_id: "V-10074" },
  { supplier_id: "SUP-08", vendor_id: "V-10049" },
  { supplier_id: "SUP-09", vendor_id: "V-10069" },
  { supplier_id: "SUP-10", vendor_id: "V-10077" },
];

export const supplierForVendor = (vendorId: string | null | undefined) => SUPPLIER_REGISTER.find((s) => s.vendor_id === vendorId)?.supplier_id ?? null;
export const vendorForSupplier = (supplierId: string) => SUPPLIER_REGISTER.find((s) => s.supplier_id === supplierId)?.vendor_id ?? null;
