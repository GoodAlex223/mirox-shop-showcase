import { z } from "zod";
import { NP_QUERY_MAX_LENGTH, NP_REF_PATTERN, WAREHOUSE_KINDS } from "@/lib/nova-poshta-shared";

// Query schemas of the two public Nova Poshta directory routes (G25). Imports the
// import-free shared module only — never the server client (`next/cache`).
export const npCitiesQuerySchema = z.object({
  q: z.string().trim().min(2).max(NP_QUERY_MAX_LENGTH),
});

export const npWarehousesQuerySchema = z.object({
  city: z.string().regex(NP_REF_PATTERN),
  kind: z.enum(WAREHOUSE_KINDS),
  q: z.string().trim().max(NP_QUERY_MAX_LENGTH),
});
