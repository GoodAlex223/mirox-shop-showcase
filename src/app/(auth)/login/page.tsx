import type { Metadata } from "next";
import { getAuthMetadata } from "@/lib/seo";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

// Task 8: getAuthMetadata is now async (reads the "seo" i18n namespace).
export async function generateMetadata(): Promise<Metadata> {
  return getAuthMetadata("login");
}

export default function LoginPage() {
  return <LoginForm />;
}
