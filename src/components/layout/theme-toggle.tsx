"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const currentTheme = theme ?? "system";

  return (
    <div className="flex rounded-lg border bg-background p-0.5" suppressHydrationWarning>
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = currentTheme === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            size="icon-sm"
            variant={active ? "secondary" : "ghost"}
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
}

export function CompactThemeToggle() {
  const { setTheme, theme } = useTheme();
  const currentTheme = theme ?? "system";
  const currentIndex = themeOptions.findIndex((option) => option.value === currentTheme);
  const activeOption = themeOptions[currentIndex >= 0 ? currentIndex : 2];
  const nextOption = themeOptions[(currentIndex + 1 + themeOptions.length) % themeOptions.length];
  const Icon = activeOption.icon;

  return (
    <Button
      type="button"
      size="icon-lg"
      variant="outline"
      className="size-10"
      aria-label={`Theme: ${activeOption.label}. Switch to ${nextOption.label}.`}
      title={`Theme: ${activeOption.label}. Switch to ${nextOption.label}.`}
      onClick={() => setTheme(nextOption.value)}
      suppressHydrationWarning
    >
      <Icon />
    </Button>
  );
}
