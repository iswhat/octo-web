import React, { useState } from "react";
import { useMatterList } from "../../hooks/useTodoList";
import MatterDetailPanel from "../MatterDetailPanel";
import SidebarCard from "../../ui/SidebarCard";
import "../../pages/MatterPage.css";

export interface ChatMatterPanelProps {
  channelId: string;
  channelType: number;
  channelName?: string;
  onClose: () => void;
}

type Tab = "mine" | "created" | "all";

export default function ChatMatterPanel({
  channelId,
  channelType,
  channelName,
  onClose,
}: ChatMatterPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);

  const { matters, loading, reload } = useMatterList({
    initialFilters: {
      source_channel_id: channelId,
      source_channel_type: channelType,
    },
    pageSize: 100,
  });

  const displayMatters = matters;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "mine", label: "我负责的" },
    { id: "created", label: "我创建的" },
    { id: "all", label: "全部" },
  ];

  if (selectedMatterId) {
    return (
      <MatterDetailPanel
        key={selectedMatterId}
        matterId={selectedMatterId}
        channelId={channelId}
        channelType={channelType}
        onClose={() => setSelectedMatterId(null)}
      />
    );
  }

  return (
    <div className="wk-mp-page-sidebar">
      <div className="wk-mp-page-sidebar__header">
        <h2 className="wk-mp-page-sidebar__title">事项</h2>
        <button
          type="button"
          className="wk-mp-page-sidebar__close"
          onClick={onClose}
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      <div className="wk-mp-page-sidebar__tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`wk-mp-page-sidebar__tab${activeTab === t.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="wk-mp-page-sidebar__list">
        {loading && <div className="wk-mp-page-sidebar__empty">加载中...</div>}
        {!loading && displayMatters.length === 0 && (
          <div className="wk-mp-page-sidebar__empty">暂无事项</div>
        )}
        {!loading &&
          displayMatters.map((matter) => (
            <SidebarCard
              key={matter.id}
              matter={matter}
              selected={false}
              onClick={() => setSelectedMatterId(matter.id)}
            />
          ))}
        {!loading && displayMatters.length > 0 && (
          <button type="button" className="wk-mp-page-sidebar__archived-toggle">
            <span className="wk-mp-page-sidebar__archived-chev">▸</span>
            已归档 (0)
          </button>
        )}
      </div>
    </div>
  );
}

export { ChatMatterPanel };
