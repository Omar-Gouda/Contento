"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { signInAction, type AuthActionResult } from "@/lib/auth/actions";
import { signInSchema, type SignInInput } from "@/lib/auth/schemas";
import { routes } from "@/constants/routes";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm({ resetSuccess = false }: { resetSuccess?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<AuthActionResult | null>(
    resetSuccess
      ? {
          success: true,
          message: "Your password was updated. Sign in with your new password.",
        }
      : null
  );
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignInInput) {
    setResult(null);
    const response = await signInAction(values);
    setResult(response);

    if (response.success && response.redirectTo) {
      router.replace(response.redirectTo);
      router.refresh();
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex items-center justify-center">
          <div className="flex items-center gap-3" aria-label="Contento">
            <span className="flex size-11 overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
            </span>
            <span className="text-left leading-none">
              <span className="block text-lg font-semibold tracking-[0.14em]">contento</span>
              <span className="mt-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-primary">
                Create. Content. Impact.
              </span>
            </span>
          </div>
        </div>
        <CardTitle>Sign in to Contento</CardTitle>
        <CardDescription>
          Access your company workspace using your Contento account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            <AlertTitle>{result.success ? "Ready" : "Sign in failed"}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                className="pl-9"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                href={routes.forgotPassword}
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
