import React from "react";
import { Channel, ChannelTypePerson } from "wukongimjssdk";
import WKAvatar from "@octo/base/src/Components/WKAvatar";
import type { Matter } from "../../bridge/types";
import UserName from "../UserName";
import { useChannelName } from "../../hooks/useChannelName";
import "./index.css";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  open: { label: "进行中", className: "wk-mp-sidebar-card__status--active" },
  done: { label: "已完成", className: "wk-mp-sidebar-card__status--done" },
  archived: {
    label: "已归档",
    className: "wk-mp-sidebar-card__status--archived",
  },
};

function formatDdl(deadline?: string): string {
  if (!deadline) return "";
  const d = new Date(deadline);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function SidebarCard({
  matter,
  selected,
  onClick,
}: {
  matter: Matter;
  selected: boolean;
  onClick: () => void;
}) {
  const status = STATUS_MAP[matter.status] || STATUS_MAP.open;
  const ddl = formatDdl(matter.deadline);
  // source_name 是创建时快照, 用 (source_channel_id, source_channel_type) 反查最新群名。
  // 反查未命中时回退到 source_name, 都没有就隐藏整块 "·#xxx" (条件已收紧到 source_channel_id)。
  const liveSourceName = useChannelName(
    matter.source_channel_id,
    matter.source_channel_type,
  );
  const displaySourceName = liveSourceName || matter.source_name;

  return (
    <button
      type="button"
      className={`wk-mp-sidebar-card${selected ? " is-selected" : ""}`}
      onClick={onClick}
    >
      <div className="wk-mp-sidebar-card__row1">
        <span className="wk-mp-sidebar-card__id">
          {matter.seq_no ? `M-${matter.seq_no}` : matter.id.slice(0, 8)}
        </span>
        <span className={`wk-mp-sidebar-card__status ${status.className}`}>
          <span className="wk-mp-sidebar-card__status-dot" />
          {status.label}
        </span>
        {ddl && <span className="wk-mp-sidebar-card__ddl">DDL {ddl}</span>}
      </div>
      <div className="wk-mp-sidebar-card__title">{matter.title}</div>
      <div className="wk-mp-sidebar-card__meta">
        <span className="wk-mp-sidebar-card__creator">
          <WKAvatar
            channel={new Channel(matter.creator_id, ChannelTypePerson)}
            style={{ width: 14, height: 14 }}
          />
          <UserName uid={matter.creator_id} />
        </span>
        <span className="wk-mp-sidebar-card__meta-label">创建</span>
        {matter.source_channel_id && displaySourceName && (
          <>
            <span className="wk-mp-sidebar-card__sep">·</span>
            <span className="wk-mp-sidebar-card__channel">
              #{displaySourceName}
            </span>
          </>
        )}
      </div>
      {matter.assignees && matter.assignees.length > 0 && (
        <div className="wk-mp-sidebar-card__owners">
          <span className="wk-mp-sidebar-card__owners-avatars">
            {matter.assignees.slice(0, 3).map((a, i) => (
              <span
                key={a.user_id}
                style={{ marginLeft: i > 0 ? -5 : 0, zIndex: 3 - i }}
              >
                <WKAvatar
                  channel={new Channel(a.user_id, ChannelTypePerson)}
                  style={{ width: 14, height: 14, border: "1.5px solid white" }}
                />
              </span>
            ))}
          </span>
          <span className="wk-mp-sidebar-card__owners-names">
            {matter.assignees.slice(0, 3).map((a, i) => (
              <React.Fragment key={a.user_id}>
                {i > 0 && "、"}
                <UserName uid={a.user_id} />
              </React.Fragment>
            ))}
            {matter.assignees.length > 3 && (
              <span className="wk-mp-sidebar-card__owners-more">
                {" "}等 {matter.assignees.length} 人
              </span>
            )}
          </span>
          <span className="wk-mp-sidebar-card__owners-label">负责</span>
        </div>
      )}
    </button>
  );
}

export { SidebarCard };
