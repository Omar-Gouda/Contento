import { Download, MessageSquare, Paperclip, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCollaborationCommentAction,
  deleteAttachmentAction,
  deleteCollaborationCommentAction,
  uploadAttachmentAction,
} from "@/lib/collaboration/actions";
import { getCollaborationData, type EntityType } from "@/lib/collaboration/queries";
import type { AuthContext } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export async function CollaborationPanel({
  context,
  entityType,
  entityId,
  redirectTo,
}: {
  context: AuthContext;
  entityType: EntityType;
  entityId: string;
  redirectTo: string;
}) {
  const data = await getCollaborationData(context, entityType, entityId);
  const canComment = hasPermission(context, "comments.create", "limited");
  const canDeleteComments = hasPermission(context, "comments.delete", "limited");
  const canUpload = hasPermission(context, "attachments.manage", "limited");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaboration</CardTitle>
        <CardDescription>Comments, mentions, and attachments for this {entityType}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {canComment && (
          <form action={addCollaborationCommentAction} className="grid gap-3">
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Label htmlFor={`comment-${entityType}-${entityId}`}>Comment</Label>
            <Input id={`comment-${entityType}-${entityId}`} name="body" placeholder="Add context or mention a teammate" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.mentionableUsers.map((user) => (
                <label key={user.id} className="flex items-center gap-2 rounded-lg border bg-secondary/30 px-3 py-2 text-sm">
                  <input type="checkbox" name="mentionUserIds" value={user.id} />
                  <span className="truncate">{user.name}</span>
                </label>
              ))}
            </div>
            <Button type="submit" variant="outline" className="w-fit">
              <MessageSquare />
              Add comment
            </Button>
          </form>
        )}

        {canUpload && (
          <form action={uploadAttachmentAction} className="grid gap-3 rounded-lg border bg-secondary/30 p-3">
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Label htmlFor={`file-${entityType}-${entityId}`}>Attachment</Label>
            <Input id={`file-${entityType}-${entityId}`} name="file" type="file" />
            <Button type="submit" variant="outline" className="w-fit">
              <Paperclip />
              Upload file
            </Button>
          </form>
        )}

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Attachments</h2>
            <Badge variant="secondary">{data.attachments.length}</Badge>
          </div>
          {data.attachments.map((attachment) => (
            <div key={attachment.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{attachment.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(attachment.file_size)} · {attachment.uploaderName ?? "Unknown"} · {formatCairoDateTime(attachment.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachment.signedUrl && (
                  <a href={attachment.signedUrl} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium">
                    <Download className="size-4" />
                    Download
                  </a>
                )}
                {canUpload && (
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="attachmentId" value={attachment.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <Button type="submit" variant="outline" size="icon" aria-label={`Delete ${attachment.file_name}`}>
                      <Trash2 />
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {!data.attachments.length && <p className="text-sm text-muted-foreground">No attachments yet.</p>}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Comments</h2>
            <Badge variant="secondary">{data.comments.length}</Badge>
          </div>
          {data.comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{comment.authorName ?? "Unknown user"}</span>
                <span>{formatCairoDateTime(comment.created_at)}</span>
              </div>
              <p>{comment.body}</p>
              {canDeleteComments && (
                <form action={deleteCollaborationCommentAction} className="mt-3">
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Trash2 />
                    Delete
                  </Button>
                </form>
              )}
            </div>
          ))}
          {!data.comments.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
