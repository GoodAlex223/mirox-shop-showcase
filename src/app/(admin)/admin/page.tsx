import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign, Mail } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getTranslations } from "next-intl/server";

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const subscriberCount = await prisma.subscriber.count({
    where: { status: "ACTIVE" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalRevenue")}</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(0)}</div>
            <p className="text-muted-foreground text-xs">{t("stats.changeFromLastMonth")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.orders")}</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-muted-foreground text-xs">{t("stats.changeFromLastMonth")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.products")}</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-muted-foreground text-xs">{t("stats.activeProducts")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.customers")}</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-muted-foreground text-xs">{t("stats.registeredUsers")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.subscribers")}</CardTitle>
            <Mail className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriberCount}</div>
            <p className="text-muted-foreground text-xs">{t("stats.activeSubscribers")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("recentOrders.title")}</CardTitle>
            <CardDescription>{t("recentOrders.empty")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("recentOrders.description")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quickActions.title")}</CardTitle>
            <CardDescription>{t("quickActions.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">- {t("quickActions.addProducts")}</p>
            <p className="text-sm">- {t("quickActions.manageCategories")}</p>
            <p className="text-sm">- {t("quickActions.configureSuppliers")}</p>
            <p className="text-sm">- {t("quickActions.updateSettings")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
