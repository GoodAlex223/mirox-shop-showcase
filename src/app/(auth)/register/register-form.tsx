"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerSchema, type RegisterInput } from "@/lib/validations";

export default function RegisterForm() {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Guarded dynamic key (next-intl v4.13.6 t.has, verified available —
        // TASK-039 Task 5): unknown/absent codes fall back to errors.generic.
        const code = result.code as string | undefined;
        const key = code ? `errors.byCode.${code}` : "";
        setError(key && t.has(key as never) ? t(key as never) : t("errors.generic"));
        return;
      }

      // Auto sign in after registration
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Registration succeeded but auto-login failed
        router.push("/login?registered=true");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("[Register Error]", error);
      setError(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("name.label")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("name.placeholder")}
                {...register("name")}
                disabled={isLoading}
              />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email.label")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("email.placeholder")}
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password.label")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("password.placeholder")}
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword.label")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("confirmPassword.placeholder")}
                {...register("confirmPassword")}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("submitting") : t("submit")}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              {t("signInLink")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
