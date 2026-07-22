import React, { useState } from "react";
import { Heart, MessageCircle, Edit, Trash, MoreVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { realPhoto } from "./avatarStyles";
import { ICommentThread } from "@/types";
import { addPostComment } from "@/services/community.service";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

const REPLIES_PREVIEW_LIMIT = 2;
const REPLIES_LOAD_MORE_BATCH = 5;

interface CommunityCommentProps {
  comment: ICommentThread;
  postId: string;
  currentUserId?: string;
  depth?: number;
  onReplyAdded: (parentId: string, reply: ICommentThread) => void;
  onEdit: (commentId: string, newText: string) => void;
  onDelete: (commentId: string) => void;
}

export const CommunityComment: React.FC<CommunityCommentProps> = ({
  comment,
  postId,
  currentUserId,
  depth = 0,
  onReplyAdded,
  onEdit,
  onDelete,
}) => {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [liked, setLiked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  // Direct replies to a top-level comment (depth 0) preview a couple by default; replies to a
  // reply (depth > 0) start fully collapsed — matches the mobile app's comment thread UX.
  const defaultVisibleReplies = depth === 0 ? REPLIES_PREVIEW_LIMIT : 0;
  const [visibleRepliesCount, setVisibleRepliesCount] = useState(defaultVisibleReplies);

  const isOwn = !!currentUserId && comment.userId === currentUserId;

  const handleSubmitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await addPostComment(postId, {
        text: replyText,
        parentId: comment.id,
      });
      const newReply: ICommentThread = {
        id: created.id,
        messageId: comment.messageId,
        userId: created.userId,
        text: created.text,
        timestamp: created.timestamp,
        parentId: comment.id,
        user: created.user
          ? { id: created.user.id, fullNames: created.user.fullNames, photo: created.user.photo ?? undefined }
          : undefined,
        replies: [],
      };
      onReplyAdded(comment.id, newReply);
      setReplyText("");
      setReplying(false);
    } catch (error) {
      console.error("Failed to add reply:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    onEdit(comment.id, editText);
    setEditing(false);
  };

  return (
    <div className={depth > 0 ? "mt-3 ml-4 sm:ml-8" : ""}>
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:bg-gray-100 transition-colors group">
        <div className="flex items-center gap-3 mb-3">
          <ProfileAvatar
            name={comment.user?.fullNames || "User"}
            photo={realPhoto(comment.user?.photo)}
            size="w-10 h-10"
            color="bg-gray-400 text-white"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{comment.user?.fullNames || "Unknown User"}</span>
              <span className="text-sm text-gray-500">
                {new Date(comment.timestamp).toLocaleDateString()} at{" "}
                {new Date(comment.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          {isOwn && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <button
                    onClick={() => {
                      setEditing(true);
                      setEditText(comment.text);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs text-gray-700 flex items-center gap-2 rounded-t-lg"
                  >
                    <Edit size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      confirm({
                        title: "Delete comment?",
                        message: "This action cannot be undone.",
                        variant: "danger",
                        confirmLabel: "Delete",
                        onConfirm: () => onDelete(comment.id),
                      });
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs text-red-600 flex items-center gap-2 rounded-b-lg"
                  >
                    <Trash size={12} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mb-3 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-gray-700 leading-relaxed">{comment.text}</p>
        )}

        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100">
          <button
            onClick={() => setLiked((v) => !v)}
            className={`flex items-center gap-1 text-sm transition-colors ${
              liked ? "text-red-500" : "text-gray-500 hover:text-red-500"
            }`}
          >
            <Heart size={14} className={liked ? "fill-current" : ""} />
            <span>Like</span>
          </button>
          <button
            onClick={() => setReplying((v) => !v)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
          >
            <MessageCircle size={14} />
            <span>Reply</span>
          </button>
        </div>

        {replying && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex gap-2">
              <Input
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleSubmitReply();
                }}
                className="flex-1"
              />
              <Button onClick={handleSubmitReply} size="sm" disabled={submitting}>
                Reply
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplying(false);
                  setReplyText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {(() => {
        const totalReplies = comment.replies?.length || 0;
        if (totalReplies === 0) return null;

        const repliesToShow = (comment.replies || []).slice(0, visibleRepliesCount);
        const hasMoreReplies = totalReplies > visibleRepliesCount;
        const isFullyCollapsed = visibleRepliesCount === 0;

        return (
          <div className="space-y-3 mt-3">
            {repliesToShow.map((reply) => (
              <CommunityComment
                key={reply.id}
                comment={reply}
                postId={postId}
                currentUserId={currentUserId}
                depth={depth + 1}
                onReplyAdded={onReplyAdded}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}

            <div className={`flex items-center gap-4 ${depth > 0 ? "ml-4 sm:ml-8" : ""}`}>
              {isFullyCollapsed ? (
                <button
                  onClick={() => setVisibleRepliesCount(REPLIES_PREVIEW_LIMIT)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View replies ({totalReplies})
                </button>
              ) : (
                hasMoreReplies && (
                  <button
                    onClick={() =>
                      setVisibleRepliesCount((c) => c + REPLIES_LOAD_MORE_BATCH)
                    }
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <ChevronDown size={14} />
                    View {Math.min(REPLIES_LOAD_MORE_BATCH, totalReplies - visibleRepliesCount)} more replies
                  </button>
                )
              )}
              {visibleRepliesCount > defaultVisibleReplies && (
                <button
                  onClick={() => setVisibleRepliesCount(defaultVisibleReplies)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ChevronUp size={14} />
                  Hide replies
                </button>
              )}
            </div>
          </div>
        );
      })()}
      {dialog}
    </div>
  );
};
