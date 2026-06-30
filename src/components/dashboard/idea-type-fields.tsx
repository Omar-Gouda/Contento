"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const platforms = ["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn"] as const;
const urgencies = ["low", "normal", "high", "urgent"] as const;
const ideaTypes = [
  { value: "post", label: "Post", description: "Static or carousel concept with visual direction." },
  { value: "reel", label: "Reel", description: "Short-form video idea with script or beats." },
  { value: "story", label: "Story", description: "Fast update with CTA and simple creative." },
] as const;

type IdeaType = "post" | "reel" | "story";

export function IdeaTypeFields({ selectClass }: { selectClass: string }) {
  const [ideaType, setIdeaType] = useState<IdeaType>("post");

  return (
    <>
      <div className="space-y-3 lg:col-span-3">
        <Label>Choose idea type</Label>
        <input type="hidden" name="ideaType" value={ideaType} />
        <div className="grid gap-3 md:grid-cols-3">
          {ideaTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setIdeaType(type.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                ideaType === type.value
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200"
                  : "bg-background hover:bg-secondary/60"
              )}
            >
              <span className="text-base font-semibold">{type.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{type.description}</span>
            </button>
          ))}
        </div>
      </div>

      {(ideaType === "post" || ideaType === "story") && (
        <>
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" name="headline" />
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="subtext">Subtext</Label>
            <Input id="subtext" name="subtext" />
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="visual">Visual direction</Label>
            <Input id="visual" name="visual" />
          </div>
        </>
      )}

      {ideaType === "story" && (
        <div className="space-y-2 lg:col-span-3">
          <Label htmlFor="cta">CTA</Label>
          <Input id="cta" name="cta" />
        </div>
      )}

      {ideaType === "reel" && (
        <div className="space-y-2 lg:col-span-3">
          <Label htmlFor="script">Script</Label>
          <textarea id="script" name="script" className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
      )}

      {ideaType === "post" && (
        <div className="space-y-2 lg:col-span-3">
          <Label>Platforms</Label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <label key={platform} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                <input type="checkbox" name="platforms" value={platform} className="size-4 rounded border-input" />
                {platform}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="urgency">Urgency</Label>
        <select id="urgency" name="urgency" defaultValue="normal" className={selectClass}>
          {urgencies.map((urgency) => <option key={urgency} value={urgency}>{urgency}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="publishingAt">Publishing datetime</Label>
        <Input id="publishingAt" name="publishingAt" type="datetime-local" />
      </div>
      <div className="space-y-2 lg:col-span-3">
        <Label htmlFor="finalDriveLink">Final Drive link</Label>
        <Input id="finalDriveLink" name="finalDriveLink" type="url" />
      </div>
    </>
  );
}
