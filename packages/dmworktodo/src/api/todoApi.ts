import axios from 'axios';
import { WKApp } from '@octo/base';
import type {
  Matter,
  MatterDetail,
  MatterChannel,
  TimelineEntry,
  PaginatedList,
  MatterListParams,
  CreateMatterReq,
  UpdateMatterReq,
  MatterStatus,
  LinkChannelReq,
  ExtractMatterReq,
  ExtractResult,
  TimelineReq,
  ListCommentsParams,
} from '../bridge/types';

/**
 * Isolated axios instance for matters service API.
 * Must NOT inherit axios.defaults.baseURL (set to '/api/v1/' by WKApp.apiClient)
 * otherwise all paths get double-prefixed.
 */
const matterAxios = axios.create({ baseURL: '' });

// Inject auth headers via interceptor (consistent with base APIClient pattern).
// Token is read at request time so it stays fresh after refresh.
matterAxios.interceptors.request.use((config) => {
  const token = WKApp.loginInfo.token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['token'] = token;
  }
  const spaceId = WKApp.shared.currentSpaceId;
  if (spaceId) {
    config.headers = config.headers ?? {};
    config.headers['X-Space-Id'] = spaceId;
  }
  return config;
});

// Handle 401 — mirror APIClient behavior (trigger logout on expired token)
matterAxios.interceptors.response.use(undefined, (err) => {
  if (err?.response?.status === 401) {
    WKApp.shared.logout();
  }
  return Promise.reject(err);
});

/**
 * Extract server error message from axios error response.
 */
function extractErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
  const msg = axiosErr?.response?.data?.error?.message;
  const raw = msg || (err instanceof Error ? err.message : 'Request failed');
  // Cap length to prevent pathologically long server error messages in toasts
  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
}

/**
 * Base path for matters service API.
 * Vite dev proxy (apps/web/vite.config.ts) rewrites /matter/* -> /* on the target.
 * Production nginx must have an equivalent rewrite rule.
 */
const BASE = '/matter/api/v1';

/**
 * Build query string params, filtering out undefined values.
 */
function buildParams(obj?: Record<string, unknown>): Record<string, string> {
  if (!obj) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Unwrap axios response — return response.data directly.
 */
async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  try {
    const resp = await matterAxios.get(`${BASE}${path}`, {
      params: buildParams(params),
    });
    return resp.data;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err));
  }
}

async function post<T>(path: string, data?: unknown): Promise<T> {
  try {
    const resp = await matterAxios.post(`${BASE}${path}`, data);
    return resp.data;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err));
  }
}

async function put<T>(path: string, data?: unknown): Promise<T> {
  try {
    const resp = await matterAxios.put(`${BASE}${path}`, data);
    return resp.data;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err));
  }
}

async function del<T>(path: string): Promise<T> {
  try {
    const resp = await matterAxios.delete(`${BASE}${path}`);
    return resp.data;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err));
  }
}

// ─── Matters ────────────────────────────────────────────

export async function listMatters(params?: MatterListParams): Promise<PaginatedList<Matter>> {
  return get<PaginatedList<Matter>>('/matters', params as unknown as Record<string, unknown>);
}

export async function getMatter(matterId: string, sourceChannelId?: string): Promise<MatterDetail> {
  return get<MatterDetail>(`/matters/${matterId}`, sourceChannelId ? { source_channel_id: sourceChannelId } : undefined);
}

export async function createMatter(req: CreateMatterReq): Promise<MatterDetail> {
  return post<MatterDetail>('/matters', req);
}

export async function updateMatter(matterId: string, req: UpdateMatterReq): Promise<MatterDetail> {
  return put<MatterDetail>(`/matters/${matterId}`, req);
}

export async function transitionMatter(matterId: string, status: MatterStatus): Promise<MatterDetail> {
  return put<MatterDetail>(`/matters/${matterId}/status`, { status });
}

export async function deleteMatter(matterId: string): Promise<void> {
  return del<void>(`/matters/${matterId}`);
}

// ─── Assignees ──────────────────────────────────────────

export async function addAssignee(matterId: string, userId: string): Promise<void> {
  return post<void>(`/matters/${matterId}/assignees`, { user_id: userId });
}

export async function removeAssignee(matterId: string, userId: string): Promise<void> {
  return del<void>(`/matters/${matterId}/assignees/${userId}`);
}

// ─── Channels ───────────────────────────────────────────

export async function linkChannel(matterId: string, req: LinkChannelReq): Promise<MatterChannel> {
  return post<MatterChannel>(`/matters/${matterId}/channels`, req);
}

export async function unlinkChannel(matterId: string, channelId: string): Promise<void> {
  return del<void>(`/matters/${matterId}/channels/${channelId}`);
}

// ─── Extract (AI 智能创建) ───────────────────────────────

// TODO(backend): 后端 feat/matter-digest-v3 分支合入后移除 mock，改为真实调用
// return post<ExtractResult>('/matters/extract', req);
export async function extractMatter(req: ExtractMatterReq): Promise<ExtractResult> {
  console.warn('[MOCK] extractMatter — 后端 /matters/extract 尚未部署，返回 mock 数据');
  await new Promise((r) => setTimeout(r, 800)); // 模拟网络延迟
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : 'mock-' + Date.now(),
    seq_no: Math.floor(Math.random() * 9000) + 1000,
    title: 'AI 提取: ' + (req.msgs[0]?.content?.slice(0, 30) || '新事项'),
    description: req.msgs.map((m) => `${m.from_uname || m.from_uid}: ${m.content}`).join('\n').slice(0, 200),
    source_msgs: req.msgs.map((m) => m.message_id),
    deadline: null,
    status: 'open',
    created_at: new Date().toISOString(),
  };
}

// ─── Timeline ───────────────────────────────────────────

// TODO(backend): 后端 feat/matter-digest-v3 分支合入后移除 mock，改为真实调用
// return get<PaginatedList<TimelineEntry>>(`/matters/${matterId}/timeline`, ...)
export async function listTimeline(matterId: string, params?: ListCommentsParams): Promise<PaginatedList<TimelineEntry>> {
  console.warn('[MOCK] listTimeline — 后端 /timeline 尚未部署，返回 mock 数据');
  return {
    data: [
      {
        id: 'tl-mock-1',
        matter_id: matterId,
        user_id: 'mock-user-1',
        content: '辉哥确认 PPT 需要加入 Coze 接入路径，作为核心亮点展示',
        channel_id: 'mock-channel-1',
        channel_type: 2,
        source_msgs: ['msg-001', 'msg-002'],
        related_uids: ['mock-user-1', 'mock-user-2'],
        created_at: new Date(Date.now() - 3600000).toISOString(),
        attachments: [],
      },
      {
        id: 'tl-mock-2',
        matter_id: matterId,
        user_id: 'mock-user-2',
        content: 'PMBot 已起草 PPT 模板初稿，待辉哥审阅',
        channel_id: 'mock-channel-1',
        channel_type: 2,
        source_msgs: ['msg-003'],
        related_uids: ['mock-user-2'],
        created_at: new Date(Date.now() - 7200000).toISOString(),
        attachments: [
          { id: 'att-mock-1', entry_id: 'tl-mock-2', file_url: '#', file_name: 'PPT-draft-v1.pptx', created_at: new Date().toISOString() },
        ],
      },
      {
        id: 'tl-mock-3',
        matter_id: matterId,
        user_id: 'mock-user-1',
        content: '事项已创建，来源: #设计群',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        attachments: [],
      },
    ],
    pagination: { has_more: false },
  };
}

// TODO(backend): 后端 feat/matter-digest-v3 分支合入后移除 mock，改为真实调用
// return post<TimelineEntry>(`/matters/${matterId}/timeline`, req)
export async function addTimelineEntry(matterId: string, req: TimelineReq): Promise<TimelineEntry> {
  console.warn('[MOCK] addTimelineEntry — 后端 /timeline 尚未部署，返回 mock 数据');
  await new Promise((r) => setTimeout(r, 300));
  return {
    id: 'tl-mock-' + Date.now(),
    matter_id: matterId,
    user_id: 'current-user',
    content: req.content || null,
    channel_id: req.channel_id,
    channel_type: req.channel_type,
    source_msgs: [],
    related_uids: [],
    created_at: new Date().toISOString(),
    attachments: [],
  };
}

// TODO(backend): 后端 feat/matter-digest-v3 分支合入后移除 mock，改为真实调用
// return del<void>(`/matters/${matterId}/timeline/${entryId}`)
export async function deleteTimelineEntry(matterId: string, entryId: string): Promise<void> {
  console.warn('[MOCK] deleteTimelineEntry — 后端 /timeline 尚未部署，mock 删除');
  await new Promise((r) => setTimeout(r, 200));
}

// ─── 兼容旧 API（deprecated） ────────────────────────────

/** @deprecated 使用 listTimeline 替代 */
export const listComments = listTimeline;
/** @deprecated 使用 addTimelineEntry 替代 */
export async function addComment(matterId: string, content: string, attachments?: { file_url: string; file_name?: string; file_size?: number; mime_type?: string }[]): Promise<TimelineEntry> {
  const body: TimelineReq = { content: content?.trim() || undefined, attachments };
  return post<TimelineEntry>(`/matters/${matterId}/timeline`, body);
}
/** @deprecated 使用 deleteTimelineEntry 替代 */
export const deleteComment = deleteTimelineEntry;
