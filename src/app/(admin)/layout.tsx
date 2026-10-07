import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { AdminSidebar } from "@/components/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  const t = await getTranslations("admin.layout");
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="bg-background flex h-16 items-center border-b px-6">
            <h1 className="text-lg font-semibold">{t("title")}</h1>
          </header>
          <main className="bg-muted/20 flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
