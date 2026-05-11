import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { MatterAssignee } from '../../bridge/types';
import './index.css';

/**
 * OwnerEditor �?负责人编辑器（对齐原�?v19 OwnersEditor�?
 *
 * 权限规则 (17-Matters-数据流修�?v0.7.md §5.1 / §5.2):
 *   - 编辑权限: 仅发起人 (creator) 或当前负责人 (assignees 之一) 可修�?
 *     ——权限矩阵里没直接列 "改负责人", �?"改状�? / "删全�? 的梯度推�?
 *   - 至少保留 1 位负责人, 不能全部移除
 *   - 候选人范围: Matter 关联的所�?channel 成员的并�?
 *     ——�?.1 "关联 channel 成员自动继承 Matter access", 负责人应当从�?access
 *       的人里�? 避免指派给看不见 Matter 的人
 *
 * 交互:
 *   - 点头像行 �?弹下�?
 *   - 候选列表来�?Matter 所有关�?channel 的成员并�?(由调用方预解析传�?
 *   - 点候选项 �?toggle 添加 / 移除
 */

export interface OwnerEditorProps {
    assignees: MatterAssignee[];
    /** 当前用户是否有编辑权�?(打开下拉�? */
    canEdit: boolean;
    /** 当前用户 UID (用于细粒度移除权限判�? */
    currentUid: string;
    /** 当前用户是否�?Matter 发起�?(creator 能移除任何人, �?creator 只能移除自己) */
    isCreator: boolean;
    /**
     * 候选成员列表（由调用方预解析）。一般是 Matter 关联的所�?channel 成员的并集�?
     * 空数组时下拉只显示当�?assignees (保证可以移除)�?
     */
    candidates: Array<{ uid: string; name?: string }>;
    /** 切换负责人回�?*/
    onToggle: (uid: string, isCurrentlyAssigned: boolean) => Promise<void>;
    /** Render an avatar for the given uid at the given pixel size */
    renderAvatar: (uid: string, size: number) => React.ReactNode;
    /** Resolve a user name for display. Falls back to uid if not provided or returns empty. */
    resolveUserName?: (uid: string) => string;
}

// ─── 下拉�?───────────────────────────────────────────

function OwnerOption({
  uid,
  name,
  picked,
  onClick,
  disabled,
  renderAvatar,
}: {
  uid: string;
  name: string;
  picked: boolean;
  onClick: () => void;
  disabled?: boolean;
  renderAvatar: (uid: string, size: number) => React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`wk-owner-editor__option${picked ? ' is-picked' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? '至少保留 1 位负责人' : undefined}
    >
      {renderAvatar(uid, 16)}
      <span className="wk-owner-editor__option-name">{name}</span>
      {picked && <span className="wk-owner-editor__option-check">�?/span>}
    </button>
  );
}

// ─── 主组�?───────────────────────────────────────────

export default function OwnerEditor({
    assignees,
    canEdit,
    currentUid,
    isCreator,
    candidates,
    onToggle,
    renderAvatar,
    resolveUserName,
}: OwnerEditorProps) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<Set<string>>(new Set());
    const ref = useRef<HTMLSpanElement>(null);

    // 关闭下拉
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

  const assignedUids = useMemo(() => new Set(assignees.map((a) => a.user_id)), [assignees]);

  // 合并候选列表：当前负责�?+ candidates（去重）
  // 保证即使 candidates 未包含当前负责人（比如跨群），也能看到并取消选择
  const mergedCandidates = useMemo(() => {
    const seen = new Set<string>();
    const list: { uid: string; name?: string }[] = [];
    for (const a of assignees) {
      if (seen.has(a.user_id)) continue;
      seen.add(a.user_id);
      list.push({ uid: a.user_id });
    }
    for (const c of candidates) {
      if (seen.has(c.uid)) continue;
      seen.add(c.uid);
      list.push({ uid: c.uid, name: c.name });
    }
    return list;
  }, [assignees, candidates]);

  const handleToggle = useCallback(
    async (uid: string) => {
      if (pending.has(uid)) return;
      const picked = assignedUids.has(uid);
      // 至少保留 1 位：如果要移除的是最后一位，拒绝
      if (picked && assignees.length <= 1) return;

      setPending((prev) => {
        const next = new Set(prev);
        next.add(uid);
        return next;
      });
      try {
        await onToggle(uid, picked);
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      }
    },
    [assignedUids, assignees.length, onToggle, pending],
  );

  const resolveName = useCallback(
    (uid: string, fallback?: string): string => {
      if (resolveUserName) {
        const resolved = resolveUserName(uid);
        if (resolved) return resolved;
      }
      return fallback || uid;
    },
    [resolveUserName],
  );

  const triggerClass = `wk-owner-editor__trigger${canEdit ? '' : ' is-readonly'}`;
  const triggerProps = canEdit
    ? { onClick: () => setOpen((o) => !o), type: 'button' as const }
    : {
                type: 'button' as const,
                disabled: true,
                title: '仅发起人或当前负责人可修�?,
            };

  return (
    <span className="wk-owner-editor" ref={ref}>
      <button {...triggerProps} className={triggerClass}>
        <span className="wk-owner-editor__avatars">
          {assignees.slice(0, 3).map((a, i) => (
            <span
              key={a.user_id}
              className="wk-owner-editor__avatar-wrap"
              style={{
                marginLeft: i > 0 ? -6 : 0,
                zIndex: assignees.length - i,
              }}
            >
              {renderAvatar(a.user_id, 16)}
            </span>
          ))}
        </span>
        <span className="wk-owner-editor__names">
          {assignees.slice(0, 3).map((a, i) => (
            <React.Fragment key={a.user_id}>
              {i > 0 && '�?}
              <OwnerNameInline uid={a.user_id} resolveName={resolveName} />
            </React.Fragment>
          ))}
          {assignees.length > 3 && (
            <span className="wk-owner-editor__names-more">
              {' '}�?{assignees.length} �?
            </span>
          )}
        </span>
      </button>

            {open && canEdit && (
                <div className="wk-owner-editor__dropdown">
                    <div className="wk-owner-editor__hint">
                        多�?· 至少保留 1 �?
                    </div>
                    <div className="wk-owner-editor__hint wk-owner-editor__hint--sub">
                        候选人来自 Matter 关联的群
                    </div>
                    {mergedCandidates.length === 0 && (
                        <div className="wk-owner-editor__empty">
                            暂无可选成�?
                        </div>
                    )}
                    {mergedCandidates.map((c) => {
                        const picked = assignedUids.has(c.uid);
                        const isLast = picked && assignees.length <= 1;
                        const isPending = pending.has(c.uid);
                        // 移除权限 (对齐后端 RemoveAssignee):
                        //   - creator 能移除任何人
                        //   - �?creator 只能移除自己 (self-unassign)
                        //   - 添加不受此限�?(AddAssignee: creator OR assignee)
                        const canRemoveThis = picked
                          ? isCreator || c.uid === currentUid
                          : true; // 不是移除操作, 不限�?
                        const disabled =
                          isLast || isPending || (picked && !canRemoveThis);
                        return (
                            <OwnerOption
                                key={c.uid}
                                uid={c.uid}
                                name={resolveName(c.uid, c.name)}
                                picked={picked}
                                onClick={() => handleToggle(c.uid)}
                                disabled={disabled}
                                renderAvatar={renderAvatar}
                            />
                        );
                    })}
                </div>
            )}
    </span>
  );
}

// 内联�?UserName（使�?resolveUserName prop 而非 hook�?
function OwnerNameInline({ uid, resolveName }: { uid: string; resolveName: (uid: string, fallback?: string) => string }) {
  return <>{resolveName(uid)}</>;
}
