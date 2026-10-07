import type { Metadata } from "next";
import { getAuthMetadata } from "@/lib/seo";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

// Task 8: getAuthMetadata is now async (reads the "seo" i18n namespace).
export async function generateMetadata(): Promise<Metadata> {
  return getAuthMetadata("register");
}

export default function RegisterPage() {
  return <RegisterForm />;
}
