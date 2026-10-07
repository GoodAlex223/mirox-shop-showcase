import { handlers } from "@/lib/auth";

// Force Node.js runtime for bcrypt and crypto compatibility
export const runtime = "nodejs";

export const { GET, POST } = handlers;
