import { buildInitialRequests, getAllSupplierViews } from "./seed";
import type { Request } from "./types";

/** Static case data → cached at build time (Cache Components). */
export async function getInitialRequests(): Promise<Request[]> {
  "use cache";
  return buildInitialRequests(await getAllSupplierViews());
}
