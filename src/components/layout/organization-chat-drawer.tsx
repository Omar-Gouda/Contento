"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MessageCircle, Paperclip, Send } from "lucide-react";

import { sendChatMessageAction } from "@/lib/chat/actions";
import type { OrganizationChatData, OrganizationChatMessage } from "@/lib/chat/queries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const [chatData, setChatData] = useState(data);
  const [selectedConversationId, setSelectedConversationId] = useState(data.conversations[0]?.id ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const newChatFormRef = useRef<HTMLFormElement>(null);
  const selectedConversation = useMemo(
    () => chatData.conversations.find((conversation) => conversation.id === selectedConversationId) ?? chatData.conversations[0] ?? null,
    [chatData.conversations, selectedConversationId]
  );
  const recipientById = useMemo(
    () => new Map(chatData.recipients.map((recipient) => [recipient.id, recipient])),
    [chatData.recipients]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setChatData(data);
      setSelectedConversationId((current) => current || (data.conversations[0]?.id ?? ""));
    });
  }, [data]);

  useEffect(() => {
    const conversationIds = new Set(chatData.conversations.map((conversation) => conversation.id));

    if (!conversationIds.size) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`contento-chat-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            conversation_id?: string;
            sender_id?: string;
            body?: string;
            created_at?: string;
          };

          if (
            !row.id ||
            !row.conversation_id ||
            !row.sender_id ||
            !row.body ||
            !row.created_at ||
            !conversationIds.has(row.conversation_id)
          ) {
            return;
          }

          appendMessage({
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.sender_id,
            senderName: row.sender_id === currentUserId
              ? "You"
              : chatData.conversations.find((conversation) => conversation.id === row.conversation_id)?.otherUserName ?? "Workspace user",
            senderAvatarUrl: row.sender_id === currentUserId
              ? null
              : chatData.conversations.find((conversation) => conversation.id === row.conversation_id)?.otherUserAvatarUrl ?? null,
            body: row.body,
            createdAt: row.created_at,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatData.conversations, currentUserId]);

  function appendMessage(message: OrganizationChatMessage, temporaryId?: string) {
    setChatData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => {
        if (conversation.id !== message.conversationId) {
          return conversation;
        }

        const messages = conversation.messages.some((row) => row.id === message.id)
          ? conversation.messages
          : conversation.messages
            .filter((row) => row.id !== temporaryId)
            .concat(message)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        return {
          ...conversation,
          updatedAt: message.createdAt,
          lastMessage: message.body,
          messages,
        };
      }),
    }));
  }

  function removeMessage(conversationId: string, messageId: string) {
    setChatData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          messages: conversation.messages.filter((message) => message.id !== messageId),
        };
      }),
    }));
  }

  function addNewConversation(
    result: {
      id: string;
      conversationId: string;
      senderId: string;
      body: string;
      createdAt: string;
    },
    recipientId: string
  ) {
    const recipient = recipientById.get(recipientId);

    if (!recipient) {
      return;
    }

    setChatData((current) => {
      if (current.conversations.some((conversation) => conversation.id === result.conversationId)) {
        return current;
      }

      return {
        ...current,
        conversations: [
          {
            id: result.conversationId,
            otherUserName: recipient.name,
            otherUserEmail: recipient.email,
            otherUserAvatarUrl: recipient.avatarUrl,
            clientName: null,
            updatedAt: result.createdAt,
            lastMessage: result.body,
            messages: [{
              id: result.id,
              conversationId: result.conversationId,
              senderId: currentUserId,
              senderName: "You",
              senderAvatarUrl: null,
              body: result.body,
              createdAt: result.createdAt,
            }],
          },
          ...current.conversations,
        ],
      };
    });
    setSelectedConversationId(result.conversationId);
  }

  function submitMessage(event: FormEvent<HTMLFormElement>, mode: "new" | "reply") {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();
    const conversationId = String(formData.get("conversationId") ?? "");
    const recipientId = String(formData.get("recipientId") ?? "");

    if (!body) {
      setStatus("Message is required.");
      return;
    }

    const temporaryId = `pending-${Date.now()}`;
    setStatus(null);

    if (mode === "reply" && conversationId) {
      appendMessage({
        id: temporaryId,
        conversationId,
        senderId: currentUserId,
        senderName: "You",
        senderAvatarUrl: null,
        body,
        createdAt: new Date().toISOString(),
      });
      form.reset();
      setTypingConversationId(null);
    }

    startTransition(async () => {
      const result = await sendChatMessageAction(formData);

      if (!result.success || !result.chatMessage) {
        if (mode === "reply" && conversationId) {
          removeMessage(conversationId, temporaryId);
        }

        setStatus(result.message);
        return;
      }

      const savedMessage: OrganizationChatMessage = {
        id: result.chatMessage.id,
        conversationId: result.chatMessage.conversationId,
        senderId: result.chatMessage.senderId,
        senderName: "You",
        senderAvatarUrl: null,
        body: result.chatMessage.body,
        createdAt: result.chatMessage.createdAt,
      };

      if (mode === "new") {
        addNewConversation(result.chatMessage, recipientId);
        newChatFormRef.current?.reset();
      } else {
        appendMessage(savedMessage, temporaryId);
      }

      setStatus(result.message);
    });
  }

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
            <form ref={newChatFormRef} onSubmit={(event) => submitMessage(event, "new")} className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="chat-recipient">Start a chat</Label>
                <select
                  id="chat-recipient"
                  name="recipientId"
                  required
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={!chatData.recipients.length || isPending}
                >
                  <option value="">Choose recipient</option>
                  {chatData.recipients.map((recipient) => (
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
                  placeholder={chatData.recipients.length ? "Write a short message..." : "No available recipients"}
                  className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={!chatData.recipients.length || isPending}
                />
              </div>
              <Button type="submit" disabled={!chatData.recipients.length || isPending}>
                <Send />
                {isPending ? "Sending..." : "Send"}
              </Button>
            </form>
          </div>

          <div className="grid min-h-0 grid-cols-[9rem_1fr] overflow-hidden">
            <div className="border-r bg-secondary/20 p-2">
              <div className="grid max-h-full gap-1 overflow-y-auto pr-1">
                {chatData.conversations.map((conversation) => (
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
                {!chatData.conversations.length && (
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
                    {typingConversationId === selectedConversation.id && (
                      <p className="text-xs text-muted-foreground">Drafting reply...</p>
                    )}
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
            {status && (
              <p className="mb-2 text-xs text-muted-foreground" role="status">
                {status}
              </p>
            )}
            <form onSubmit={(event) => submitMessage(event, "reply")} className="flex gap-2">
              <input type="hidden" name="conversationId" value={selectedConversation?.id ?? ""} />
              <textarea
                name="body"
                required
                maxLength={2000}
                placeholder={selectedConversation ? "Reply..." : "Select a chat first"}
                className="min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={!selectedConversation || isPending}
                onChange={(event) => setTypingConversationId(event.currentTarget.value.trim() ? selectedConversation?.id ?? null : null)}
              />
              <Button type="button" size="icon" variant="outline" aria-label="Attachments coming soon" disabled title="Attachments are ready for a future upload flow">
                <Paperclip />
              </Button>
              <Button type="submit" size="icon" aria-label="Send message" disabled={!selectedConversation || isPending}>
                <Send />
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
