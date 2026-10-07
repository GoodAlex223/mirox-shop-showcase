"use client";
export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountPage() {
  const t = useTranslations("account");
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        {/* inline: Tailwind v4 arbitrary grid template with nested commas doesn't compile here — see task-14 report */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))" }}
        >
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card>
        <CardContent className="py-6">
          <h2 className="text-xl font-semibold">
            {t("overview.welcome", { name: session?.user?.name || t("overview.nameFallback") })}
          </h2>
          <p className="text-muted-foreground mt-1">{t("overview.description")}</p>
        </CardContent>
      </Card>

      {/* Quick Links */}
      {/* inline: Tailwind v4 arbitrary grid template with nested commas doesn't compile here — see task-14 report */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))" }}
      >
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Package className="text-primary h-5 w-5" />
            </div>
            <CardTitle className="text-base">{t("overview.ordersCard.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              {t("overview.ordersCard.description")}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/orders">
                {t("overview.ordersCard.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("overview.info.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">{t("overview.info.name")}</p>
              <p>{session?.user?.name || t("overview.info.notSet")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                {t("overview.info.email")}
              </p>
              <p>{session?.user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
