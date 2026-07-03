"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { useForm } from "react-hook-form";

import { changePasswordAction, type AuthActionResult } from "@/lib/auth/actions";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/auth/schemas";
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

export function ChangePasswordForm({ variant = "card" }: { variant?: "card" | "plain" }) {
  const router = useRouter();
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setResult(null);
    const response = await changePasswordAction(values);
    setResult(response);

    if (response.success && response.redirectTo) {
      router.replace(response.redirectTo);
      router.refresh();
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  const formContent = (
    <div className="space-y-5">
      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle>{result.success ? "Password updated" : "Update failed"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </div>
  );

  if (variant === "plain") {
    return formContent;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="size-5 text-primary" />
          Change password
        </CardTitle>
        <CardDescription>
          Choose a new secure password for your Contento account.
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
