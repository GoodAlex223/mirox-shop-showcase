"use client";

import { useState } from "react";
import { Save, Store, Mail, CreditCard, Truck, Bell, Shield } from "lucide-react";
import { BRAND_NAME } from "@/content/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const [isSaving, setIsSaving] = useState(false);

  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    storeName: process.env.NEXT_PUBLIC_STORE_NAME || BRAND_NAME,
    storeDescription: t("defaults.storeDescription"),
    contactEmail: "support@store.com",
    supportPhone: "",
    address: "",
  });

  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    orderConfirmation: true,
    shippingUpdates: true,
    marketingEmails: false,
    lowStockAlerts: true,
  });

  // Shipping settings
  const [shippingSettings, setShippingSettings] = useState({
    freeShippingThreshold: "50",
    defaultShippingRate: "5.99",
    expressShippingRate: "15.99",
  });

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      // In a real app, this would save to the backend
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success(t("general.saveSuccess"));
    } catch {
      toast.error(t("general.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success(t("email.saveSuccess"));
    } catch {
      toast.error(t("email.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveShipping = async () => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success(t("shipping.saveSuccess"));
    } catch {
      toast.error(t("shipping.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Store className="h-4 w-4" />
            {t("tabs.general")}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            {t("tabs.email")}
          </TabsTrigger>
          <TabsTrigger value="shipping" className="gap-2">
            <Truck className="h-4 w-4" />
            {t("tabs.shipping")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {t("tabs.payments")}
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("general.cardTitle")}</CardTitle>
              <CardDescription>{t("general.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="storeName">{t("general.storeNameLabel")}</Label>
                  <Input
                    id="storeName"
                    value={storeSettings.storeName}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, storeName: e.target.value }))
                    }
                    placeholder={t("general.storeNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t("general.contactEmailLabel")}</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={storeSettings.contactEmail}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, contactEmail: e.target.value }))
                    }
                    placeholder="support@store.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeDescription">{t("general.storeDescriptionLabel")}</Label>
                <Textarea
                  id="storeDescription"
                  value={storeSettings.storeDescription}
                  onChange={(e) =>
                    setStoreSettings((prev) => ({ ...prev, storeDescription: e.target.value }))
                  }
                  placeholder={t("general.storeDescriptionPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supportPhone">{t("general.supportPhoneLabel")}</Label>
                  <Input
                    id="supportPhone"
                    value={storeSettings.supportPhone}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, supportPhone: e.target.value }))
                    }
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t("general.addressLabel")}</Label>
                  <Input
                    id="address"
                    value={storeSettings.address}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder={t("general.addressPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveGeneral} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? t("saving") : t("saveChangesButton")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t("email.cardTitle")}
              </CardTitle>
              <CardDescription>{t("email.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("email.orderConfirmationLabel")}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t("email.orderConfirmationDescription")}
                  </p>
                </div>
                <Switch
                  checked={emailSettings.orderConfirmation}
                  onCheckedChange={(checked) =>
                    setEmailSettings((prev) => ({ ...prev, orderConfirmation: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("email.shippingUpdatesLabel")}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t("email.shippingUpdatesDescription")}
                  </p>
                </div>
                <Switch
                  checked={emailSettings.shippingUpdates}
                  onCheckedChange={(checked) =>
                    setEmailSettings((prev) => ({ ...prev, shippingUpdates: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("email.marketingEmailsLabel")}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t("email.marketingEmailsDescription")}
                  </p>
                </div>
                <Switch
                  checked={emailSettings.marketingEmails}
                  onCheckedChange={(checked) =>
                    setEmailSettings((prev) => ({ ...prev, marketingEmails: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("email.lowStockAlertsLabel")}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t("email.lowStockAlertsDescription")}
                  </p>
                </div>
                <Switch
                  checked={emailSettings.lowStockAlerts}
                  onCheckedChange={(checked) =>
                    setEmailSettings((prev) => ({ ...prev, lowStockAlerts: checked }))
                  }
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveEmail} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? t("saving") : t("saveChangesButton")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shipping Settings */}
        <TabsContent value="shipping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("shipping.cardTitle")}</CardTitle>
              <CardDescription>{t("shipping.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="freeShipping">{t("shipping.freeShippingLabel")}</Label>
                  <Input
                    id="freeShipping"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingSettings.freeShippingThreshold}
                    onChange={(e) =>
                      setShippingSettings((prev) => ({
                        ...prev,
                        freeShippingThreshold: e.target.value,
                      }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">{t("shipping.freeShippingHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="standardRate">{t("shipping.standardShippingLabel")}</Label>
                  <Input
                    id="standardRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingSettings.defaultShippingRate}
                    onChange={(e) =>
                      setShippingSettings((prev) => ({
                        ...prev,
                        defaultShippingRate: e.target.value,
                      }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("shipping.standardShippingHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expressRate">{t("shipping.expressShippingLabel")}</Label>
                  <Input
                    id="expressRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingSettings.expressShippingRate}
                    onChange={(e) =>
                      setShippingSettings((prev) => ({
                        ...prev,
                        expressShippingRate: e.target.value,
                      }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("shipping.expressShippingHint")}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveShipping} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? t("saving") : t("saveChangesButton")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Settings */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("payments.cardTitle")}
              </CardTitle>
              <CardDescription>{t("payments.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#635BFF]">
                    <span className="text-sm font-bold text-white">S</span>
                  </div>
                  <div>
                    <p className="font-medium">Stripe</p>
                    <p className="text-muted-foreground text-sm">
                      {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                        ? t("payments.connected")
                        : t("payments.notConfigured")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
                <CreditCard className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2 text-sm">{t("payments.envNotice")}</p>
                <p className="mt-1 text-xs">{t("payments.envDetail")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
