import React from "react";
import type { SourceItem } from "../types/summary";
import { SourceType } from "../types/summary";
import type { SourceTypeValue } from "../types/summary";

interface SelectedSourcesPanelProps {
    sources: SourceItem[];
}

const SelectedSourcesPanel: React.FC<SelectedSourcesPanelProps> = ({ sources }) => {
    if (!sources || sources.length === 0) return null;

    const getIcon = (sourceType: SourceTypeValue): string => {
        switch (sourceType) {
            case SourceType.GROUP_CHAT:
                return "👥";
            case SourceType.THREAD:
                return "💬";
            case SourceType.DIRECT_MESSAGE:
                return "👤";
            default:
                return "📄";
        }
    };

    const getDisplayName = (source: SourceItem): string => {
        return source.source_name || source.source_id;
    };

    return (
        <div className="selected-sources-panel">
            <div className="selected-sources-header">
                <span>📋 已选择的信息来源</span>
            </div>
            <div className="selected-sources-list">
                {sources.map((source) => (
                    <div key={`${source.source_type}-${source.source_id}`} className="selected-sources-item">
                        <span className="selected-sources-item-icon">
                            {getIcon(source.source_type)}
                        </span>
                        <span className="selected-sources-item-name">
                            {getDisplayName(source)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SelectedSourcesPanel;
