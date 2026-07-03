"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, MessageCircle, Paperclip, Send } from "lucide-react";

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
  companyId,
}: {
  data: OrganizationChatData;
  currentUserId: string;
  companyId: string;
}) {
  const [chatData, setChatData] = useState(data);
  const [selectedConversationId, setSelectedConversationId] = useState(data.conversations[0]?.id ?? "");
  const [mobileMessageOpen, setMobileMessageOpen] = useState(false);
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

  const appendMessage = useCallback((message: OrganizationChatMessage, temporaryId?: string) => {
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
          unreadCount: message.senderId === currentUserId || message.conversationId === selectedConversationId
            ? conversation.unreadCount
            : conversation.unreadCount + 1,
          messages,
        };
      }),
    }));
  }, [currentUserId, selectedConversationId]);

  useEffect(() => {
    const conversationIds = new Set(chatData.conversations.map((conversation) => conversation.id));

    if (!conversationIds.size) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    async function refreshKnownConversationMessages() {
      const ids = Array.from(conversationIds);

      if (!ids.length) {
        return;
      }

      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, company_id, conversation_id, sender_id, body, read_at, created_at")
        .eq("company_id", companyId)
        .in("conversation_id", ids)
        .order("created_at", { ascending: true })
        .limit(250);

      const messages = (rows as Array<{
        id: string;
        conversation_id: string;
        sender_id: string;
        body: string;
        read_at: string | null;
        created_at: string;
      }> | null) ?? [];

      setChatData((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) => {
          const conversationRows = messages.filter((message) => message.conversation_id === conversation.id);

          if (!conversationRows.length) {
            return conversation;
          }

          const conversationMessages = conversationRows.map((message) => ({
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            senderName: message.sender_id === currentUserId ? "You" : conversation.otherUserName,
            senderAvatarUrl: message.sender_id === currentUserId ? null : conversation.otherUserAvatarUrl,
            body: message.body,
            createdAt: message.created_at,
          }));

          return {
            ...conversation,
            updatedAt: conversationMessages.at(-1)?.createdAt ?? conversation.updatedAt,
            lastMessage: conversationMessages.at(-1)?.body ?? conversation.lastMessage,
            messages: conversationMessages,
            unreadCount: conversationRows.filter((message) => message.sender_id !== currentUserId && !message.read_at).length,
          };
        }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      }));
    }

    const channel = supabase
      .channel(`contento-chat-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `company_id=eq.${companyId}`,
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
    const pollingId = window.setInterval(() => {
      void refreshKnownConversationMessages();
    }, 25000);

    return () => {
      window.clearInterval(pollingId);
      void supabase.removeChannel(channel);
    };
  }, [appendMessage, chatData.conversations, companyId, currentUserId]);

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
            unreadCount: 0,
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
    setMobileMessageOpen(true);
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
      <SheetContent side="right" className="h-[100dvh] max-h-[100dvh] w-screen gap-0 overflow-hidden p-0 md:w-[min(100vw,34rem)] md:max-w-[34rem]">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Organization chat</SheetTitle>
          <SheetDescription>Direct messages inside your workspace and assigned client scope.</SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] overflow-hidden">
          <div className={cn("border-b p-4", mobileMessageOpen && "hidden md:block")}>
            <form ref={newChatFormRef} onSubmit={(event) => submitMessage(event, "new")} className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="chat-recipient">Start a chat</Label>
                <select
                  id="chat-recipient"
                  name="recipientId"
                  required
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:px-2.5"
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

          <div className="grid min-h-0 overflow-hidden md:grid-cols-[11rem_1fr]">
            <div className={cn("border-r bg-secondary/20 p-2", mobileMessageOpen && "hidden md:block")}>
              <div className="grid max-h-full gap-1 overflow-y-auto pr-1">
                {chatData.conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setMobileMessageOpen(true);
                      setChatData((current) => ({
                        ...current,
                        conversations: current.conversations.map((row) => row.id === conversation.id ? { ...row, unreadCount: 0 } : row),
                      }));
                    }}
                    className={cn(
                      "min-h-16 rounded-lg p-3 text-left text-xs transition-colors md:min-h-14 md:p-2",
                      selectedConversation?.id === conversation.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-background"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="block truncate font-semibold">{conversation.otherUserName}</span>
                      {conversation.unreadCount > 0 && (
                        <span className="rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate opacity-75">{conversation.lastMessage ?? conversation.clientName ?? "No messages yet"}</span>
                  </button>
                ))}
                {!chatData.conversations.length && (
                  <p className="rounded-lg border border-dashed bg-background px-2 py-5 text-center text-xs text-muted-foreground">
                    No chats yet.
                  </p>
                )}
              </div>
            </div>

            <div className={cn("min-h-0 overflow-y-auto p-4", !mobileMessageOpen && "hidden md:block")}>
              {selectedConversation ? (
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 rounded-lg border bg-secondary/25 p-3">
                    <Button type="button" variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMobileMessageOpen(false)} aria-label="Back to conversations">
                      <ArrowLeft />
                    </Button>
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
                            {!ownMessage && <p className="mb-1 text-xs font-medium text-muted-foreground">{message.senderName}</p>}
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

          <div className={cn("border-t bg-popover p-4", !mobileMessageOpen && "hidden md:block")}>
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
