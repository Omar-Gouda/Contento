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
