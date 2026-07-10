import type { AuthContext } from "@/lib/auth/permissions";

export function demoWriteMarker(context: AuthContext) {
  if (!context.isDemo || !context.demoSessionId || !context.demoExpiresAt) {
    return {};
  }

  return {
    demo_session_id: context.demoSessionId,
    created_by_demo: true,
    demo_expires_at: context.demoExpiresAt,
  };
}
