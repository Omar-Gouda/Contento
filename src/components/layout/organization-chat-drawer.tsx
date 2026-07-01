"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";

import { sendChatMessageAction } from "@/lib/chat/actions";
import type { OrganizationChatData } from "@/lib/chat/queries";
import { formatCairoDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CU";
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary text-xs font-semibold">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

export function OrganizationChatDrawer({
  data,
  currentUserId,
}: {
  data: OrganizationChatData;
  currentUserId: string;
}) {
  const pathname = usePathname();
  const [selectedConversationId, setSelectedConversationId] = useState(data.conversations[0]?.id ?? "");
  const selectedConversation = useMemo(
    () => data.conversations.find((conversation) => conversation.id === selectedConversationId) ?? data.conversations[0] ?? null,
    [data.conversations, selectedConversationId]
  );

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="icon" aria-label="Open organization chat" />
        }
      >
        <MessageCircle />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100vw,30rem)] gap-0 p-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Organization chat</SheetTitle>
          <SheetDescription>Direct messages inside your workspace and assigned client scope.</SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto]">
          <div className="border-b p-4">
            <form action={sendChatMessageAction} className="grid gap-3">
              <input type="hidden" name="redirectTo" value={pathname} />
              <div className="grid gap-2">
                <Label htmlFor="chat-recipient">Start a chat</Label>
                <select
                  id="chat-recipient"
                  name="recipientId"
                  required
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={!data.recipients.length}
                >
                  <option value="">Choose recipient</option>
                  {data.recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.name} ({recipient.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chat-new-message">Message</Label>
                <textarea
                  id="chat-new-message"
                  name="body"
                  required
                  maxLength={2000}
                  placeholder={data.recipients.length ? "Write a short message..." : "No available recipients"}
                  className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={!data.recipients.length}
                />
              </div>
              <Button type="submit" disabled={!data.recipients.length}>
                <Send />
                Send
              </Button>
            </form>
          </div>

          <div className="grid min-h-0 grid-cols-[9rem_1fr] overflow-hidden">
            <div className="border-r bg-secondary/20 p-2">
              <div className="grid max-h-full gap-1 overflow-y-auto pr-1">
                {data.conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={cn(
                      "rounded-lg p-2 text-left text-xs transition-colors",
                      selectedConversation?.id === conversation.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-background"
                    )}
                  >
                    <span className="block truncate font-semibold">{conversation.otherUserName}</span>
                    <span className="mt-1 block truncate opacity-75">
                      {conversation.lastMessage ?? conversation.clientName ?? "No messages yet"}
                    </span>
                  </button>
                ))}
                {!data.conversations.length && (
                  <p className="rounded-lg border border-dashed bg-background px-2 py-5 text-center text-xs text-muted-foreground">
                    No chats yet.
                  </p>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto p-4">
              {selectedConversation ? (
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 rounded-lg border bg-secondary/25 p-3">
                    <Avatar name={selectedConversation.otherUserName} url={selectedConversation.otherUserAvatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{selectedConversation.otherUserName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedConversation.clientName ?? selectedConversation.otherUserEmail}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {selectedConversation.messages.map((message) => {
                      const ownMessage = message.senderId === currentUserId;

                      return (
                        <div
                          key={message.id}
                          className={cn("flex gap-2", ownMessage && "justify-end")}
                        >
                          {!ownMessage && <Avatar name={message.senderName} url={message.senderAvatarUrl} />}
                          <div className={cn("max-w-[85%] rounded-xl border px-3 py-2", ownMessage ? "bg-primary text-primary-foreground" : "bg-card")}>
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                            <p className={cn("mt-1 text-[11px]", ownMessage ? "text-primary-foreground/75" : "text-muted-foreground")}>
                              {formatCairoDateTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {!selectedConversation.messages.length && (
                      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                        No messages in this conversation yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                  Choose a recipient to start a workspace conversation.
                </p>
              )}
            </div>
          </div>

          <div className="border-t p-4">
            <form action={sendChatMessageAction} className="flex gap-2">
              <input type="hidden" name="redirectTo" value={pathname} />
              <input type="hidden" name="conversationId" value={selectedConversation?.id ?? ""} />
              <textarea
                name="body"
                required
                maxLength={2000}
                placeholder={selectedConversation ? "Reply..." : "Select a chat first"}
                className="min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={!selectedConversation}
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={!selectedConversation}>
                <Send />
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
