import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/admin";
import { getTranslations } from "next-intl/server";

export default async function NewProductPage() {
  const t = await getTranslations("admin.products");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h2>
          <p className="text-muted-foreground">{t("newDescription")}</p>
        </div>
      </div>

      <ProductForm />
    </div>
  );
}
