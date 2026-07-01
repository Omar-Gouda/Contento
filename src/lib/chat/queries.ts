import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database } from "@/types/database";

type ChatConversationRow = Database["public"]["Tables"]["chat_conversations"]["Row"];
type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];
type ChatUserRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "first_name" | "last_name" | "avatar_url"
>;
type ChatClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name">;

export type OrganizationChatUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type OrganizationChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
};

export type OrganizationChatConversation = {
  id: string;
  otherUserName: string;
  otherUserEmail: string;
  otherUserAvatarUrl: string | null;
  clientName: string | null;
  updatedAt: string;
  messages: OrganizationChatMessage[];
  lastMessage: string | null;
};

export type OrganizationChatData = {
  conversations: OrganizationChatConversation[];
  recipients: OrganizationChatUser[];
};

function displayName(user: Pick<ChatUserRow, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!user) {
    return "Unknown User";
  }

  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
}

export async function getOrganizationChatData(context: AuthContext): Promise<OrganizationChatData> {
  const supabase = await createSupabaseServerClient();
  const [
    { data: conversations, error: conversationsError },
    { data: users, error: usersError },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("id, company_id, client_id, participant_one_id, participant_two_id, created_by, created_at, updated_at")
      .eq("company_id", context.companyId)
      .or(`participant_one_id.eq.${context.userId},participant_two_id.eq.${context.userId}`)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("users")
      .select("id, email, first_name, last_name, avatar_url")
      .eq("company_id", context.companyId)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
    supabase
      .from("clients")
      .select("id, name")
      .eq("company_id", context.companyId),
  ]);

  if (conversationsError || usersError) {
    throw new Error("Unable to load organization chat.");
  }

  const conversationRows = (conversations as ChatConversationRow[] | null) ?? [];
  const conversationIds = conversationRows.map((conversation) => conversation.id);
  const { data: messages, error: messagesError } = conversationIds.length
    ? await supabase
      .from("chat_messages")
      .select("id, company_id, conversation_id, sender_id, body, read_at, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (messagesError) {
    throw new Error("Unable to load organization chat messages.");
  }

  const userRows = (users as ChatUserRow[] | null) ?? [];
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const clientById = new Map(((clients as ChatClientRow[] | null) ?? []).map((client) => [client.id, client.name]));
  const messagesByConversation = new Map<string, OrganizationChatMessage[]>();

  ((messages as ChatMessageRow[] | null) ?? []).forEach((message) => {
    const sender = userById.get(message.sender_id);
    const rows = messagesByConversation.get(message.conversation_id) ?? [];

    rows.push({
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      senderName: displayName(sender),
      senderAvatarUrl: sender?.avatar_url ?? null,
      body: message.body,
      createdAt: message.created_at,
    });
    messagesByConversation.set(message.conversation_id, rows);
  });

  return {
    conversations: conversationRows.map((conversation) => {
      const otherUserId = conversation.participant_one_id === context.userId
        ? conversation.participant_two_id
        : conversation.participant_one_id;
      const otherUser = userById.get(otherUserId);
      const conversationMessages = messagesByConversation.get(conversation.id) ?? [];
      const lastMessage = conversationMessages.at(-1)?.body ?? null;

      return {
        id: conversation.id,
        otherUserName: displayName(otherUser),
        otherUserEmail: otherUser?.email ?? "",
        otherUserAvatarUrl: otherUser?.avatar_url ?? null,
        clientName: conversation.client_id ? clientById.get(conversation.client_id) ?? null : null,
        updatedAt: conversation.updated_at,
        messages: conversationMessages,
        lastMessage,
      };
    }),
    recipients: userRows
      .filter((user) => user.id !== context.userId)
      .map((user) => ({
        id: user.id,
        name: displayName(user),
        email: user.email,
        avatarUrl: user.avatar_url,
      })),
  };
}
