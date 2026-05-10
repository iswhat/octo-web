// Matter module type definitions — aligned with matters service backend models.
// Frontend uses Matter types naming for backwards compatibility at the UI layer;
// the wire types match the backend Matter* structs.

// ─── Status enums ───────────────────────────────────────

export type MatterStatus = "open" | "done" | "archived";

// ─── Core models (match backend JSON exactly) ───────────

/**
 * Matter — from model.Matter in matters service.
 * `assignees` is only present in MatterDetail responses (GET /matters/:id, POST /matters).
 */
export interface Matter {
  id: string;
  seq_no: number;
  space_id: string;
  title: string;
  description?: string;
  creator_id: string;
  status: MatterStatus;
  deadline?: string;
  remind_at?: string;
  source_channel_id?: string;
  source_channel_type?: number;
  source_name?: string;
  assignees?: MatterAssignee[];
  created_at: string;
  updated_at: string;
}

/**
 * MatterDetail — from service.MatterDetail, returned by GET /matters/:id and POST /matters.
 * Extends Matter with assignees, participants, and linked channels.
 */
export interface MatterDetail extends Matter {
  assignees: MatterAssignee[];
  participants?: string[];
  channels?: MatterChannel[];
}

export interface MatterAssignee {
  id: string;
  matter_id: string;
  user_id: string;
  created_at: string;
}

export interface MatterChannel {
  id: string;
  matter_id: string;
  channel_id: string;
  channel_type: number;
  channel_name?: string;
  linked_by: string;
  created_at: string;
}

export interface TimelineAttachment {
  id: string;
  entry_id: string;
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  matter_id: string;
  user_id: string;
  content: string | null;
  channel_id?: string;
  channel_type?: number;
  source_channel_id?: string;
  source_msgs?: string[];
  related_uids?: string[];
  created_at: string;
  attachments?: TimelineAttachment[];
}

/** @deprecated 使用 TimelineEntry 替代 */
export type MatterComment = TimelineEntry;
/** @deprecated 使用 TimelineAttachment 替代 */
export type CommentAttachment = TimelineAttachment;

// ─── Pagination ─────────────────────────────────────────

export interface Pagination {
  has_more: boolean;
  next_cursor?: string;
}

export interface PaginatedList<T> {
  data: T[];
  pagination: Pagination;
}

// ─── Request types ──────────────────────────────────────

export interface MatterListParams {
  status?: MatterStatus;
  assignee_id?: string;
  creator_id?: string;
  source_channel_id?: string;
  source_channel_type?: number;
  q?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateMatterReq {
  title: string;
  description?: string;
  assignee_ids?: string[];
  source_channel_id?: string;
  source_channel_type?: number;
  source_name?: string;
  deadline?: string;
  remind_at?: string;
}

export interface UpdateMatterReq {
  title?: string;
  description?: string | null;
  deadline?: string | null;
  remind_at?: string | null;
}

// ─── Extract (AI 智能创建) ──────────────────────────────

export interface ExtractMessageAttachment {
  file_name: string;
  file_url: string;
}

export interface ExtractMessage {
  message_id: string;
  from_uid: string;
  from_uname?: string;
  timestamp?: number;
  content?: string;
  attachments?: ExtractMessageAttachment[];
}

export interface ExtractMatterReq {
  channel_type: number;
  channel_id: string;
  channel_name?: string;
  creator_uid: string;
  msgs: ExtractMessage[];
}

export interface ExtractResult {
  id: string;
  seq_no: number;
  title: string;
  description: string;
  source_msgs: string[];
  deadline?: number | null;
  status: string;
  created_at: string;
}

// ─── Timeline ───────────────────────────────────────────

export interface TimelineAttachmentReq {
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

export interface TimelineReq {
  content?: string;
  attachments?: TimelineAttachmentReq[];
  channel_id?: string;
  channel_type?: number;
  channel_name?: string;
  participant_uid?: string;
  msgs?: ExtractMessage[];
}

/** @deprecated 使用 TimelineAttachmentReq 替代 */
export type CommentAttachmentReq = TimelineAttachmentReq;
/** @deprecated 使用 TimelineReq 替代 */
export type AddCommentReq = TimelineReq;

export interface LinkChannelReq {
  channel_id: string;
  channel_type: number;
  channel_name?: string;
}

export interface ListCommentsParams {
  source_channel_id?: string;
  limit?: number;
  cursor?: string;
}

// ─── API error ──────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
