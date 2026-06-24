"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Building2, CheckCircle2, Link2, Loader2, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { completeOnboardingAction, type AuthActionResult } from "@/lib/auth/actions";
import { onboardingSchema, type OnboardingInput } from "@/lib/auth/schemas";
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

type OnboardingFormProps = {
  email: string | null;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingForm({ email }: OnboardingFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      companyName: "",
      companySlug: "",
      firstName: "",
      lastName: "",
    },
  });

  function fillSlugFromCompanyName() {
    const currentSlug = form.getValues("companySlug");

    if (!currentSlug) {
      form.setValue("companySlug", slugify(form.getValues("companyName")), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  async function onSubmit(values: OnboardingInput) {
    setResult(null);
    const response = await completeOnboardingAction(values);
    setResult(response);

    if (response.success && response.redirectTo) {
      router.replace(response.redirectTo);
      router.refresh();
    }
  }

  const isSubmitting = form.formState.isSubmitting;
  const companyNameField = form.register("companyName");

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Create your Contento workspace</CardTitle>
        <CardDescription>
          Set up the first company workspace and admin profile for {email ?? "your signed-in account"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            <AlertTitle>{result.success ? "Workspace ready" : "Setup failed"}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName">Company name</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="companyName"
                  autoComplete="organization"
                  placeholder="Acme Studio"
                  className="pl-9"
                  aria-invalid={Boolean(form.formState.errors.companyName)}
                  {...companyNameField}
                  onBlur={(event) => {
                    companyNameField.onBlur(event);
                    fillSlugFromCompanyName();
                  }}
                />
              </div>
              {form.formState.errors.companyName && (
                <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companySlug">Company slug</Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="companySlug"
                  autoComplete="off"
                  placeholder="acme-studio"
                  className="pl-9"
                  aria-describedby="companySlugHelp"
                  aria-invalid={Boolean(form.formState.errors.companySlug)}
                  {...form.register("companySlug")}
                />
              </div>
              <p id="companySlugHelp" className="text-sm text-muted-foreground">
                Lowercase letters, numbers, and hyphens.
              </p>
              {form.formState.errors.companySlug && (
                <p className="text-sm text-destructive">{form.formState.errors.companySlug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  placeholder="Maya"
                  className="pl-9"
                  aria-invalid={Boolean(form.formState.errors.firstName)}
                  {...form.register("firstName")}
                />
              </div>
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  placeholder="Hassan"
                  className="pl-9"
                  aria-invalid={Boolean(form.formState.errors.lastName)}
                  {...form.register("lastName")}
                />
              </div>
              {form.formState.errors.lastName && (
                <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create workspace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
