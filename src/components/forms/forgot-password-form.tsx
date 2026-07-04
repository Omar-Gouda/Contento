"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  forgotPasswordAction,
  type AuthActionResult,
} from "@/lib/auth/actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/auth/schemas";
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

export function ForgotPasswordForm() {
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setResult(null);
    const response = await forgotPasswordAction(values);
    setResult(response);

    if (response.success) {
      form.reset();
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex items-center justify-center">
          <div className="flex items-center gap-3" aria-label="Contento">
            <span className="flex size-10 overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
            </span>
            <span className="text-left leading-none">
              <span className="block text-base font-semibold tracking-[0.14em]">contento</span>
              <span className="mt-1 block text-[0.56rem] font-bold uppercase tracking-[0.28em] text-primary">
                Secure access
              </span>
            </span>
          </div>
        </div>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your account email and we will send a secure reset link. If that inbox cannot receive recovery links, contact your Marketing Manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            <AlertTitle>{result.success ? "Check your email" : "Reset failed"}</AlertTitle>
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href={routes.signIn} className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
