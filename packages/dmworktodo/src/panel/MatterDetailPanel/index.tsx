import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { MatterDetail, MatterStatus, MatterChannel as MatterChannelModel } from '../../bridge/types';
import { getMatter, transitionMatter } from '../../api/todoApi';
import { Toast } from '../../utils/toast';
import './index.css';

export interface MatterDetailPanelProps {
  channelId: string;
  channelType: number;
  /** 鐩存帴浼犲叆 matter ID锛堜粠鍒楄〃鐐瑰嚮杩涘叆鏃讹級 */
  matterId?: string;
  onClose: () => void;
}

type TabKey = 'channels' | 'outputs' | 'changelog';

/**
 * MatterDetailPanel 鈥?浜嬮」璇︽儏闈㈡澘
 *
 * 鏁版嵁鏉ユ簮锛欸ET /matters/:id 鐪熷疄 API
 * 涓?tab锛氬叧鑱旂兢鑱?/ 浜у嚭鏂囦欢 / 鍙樻洿璁板綍锛堝悗绔殏涓嶆敮鎸佺殑鏄剧ず绌烘€侊級
 */
export default function MatterDetailPanel({ channelId, channelType, matterId, onClose }: MatterDetailPanelProps) {
  const [matter, setMatter] = useState<MatterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('channels');

  // 鑾峰彇 matter 璇︽儏
  useEffect(() => {
    if (!matterId) {
      setMatter(null);
      return;
    }
    setLoading(true);
    setError(null);
    getMatter(matterId, channelId || undefined)
      .then((detail) => {
        setMatter(detail);
      })
      .catch((err) => {
        setError(err?.message || '鍔犺浇澶辫触');
        setMatter(null);
      })
      .finally(() => setLoading(false));
  }, [matterId, channelId]);

  // 鐘舵€佸垏鎹?
  const handleStatusChange = useCallback(async (newStatus: MatterStatus) => {
    if (!matter) return;
    const oldStatus = matter.status;
    // 涔愯鏇存柊
    setMatter((prev) => prev ? { ...prev, status: newStatus } : prev);
    try {
      const updated = await transitionMatter(matter.id, newStatus);
      setMatter(updated);
    } catch {
      // 鍥炴粴
      setMatter((prev) => prev ? { ...prev, status: oldStatus } : prev);
      Toast.error('鐘舵€佷慨鏀瑰け璐?);
    }
  }, [matter]);

  // 绌烘€?/ 鍔犺浇鎬?
  if (!matterId) {
    return (
      <div className="wk-mp">
        <div className="wk-mp-head">
          <div className="wk-mp-head__row1">
            <span className="wk-mp-head__id">浜嬮」</span>
            <div className="wk-mp-head__actions">
              <button type="button" className="wk-mp-head__close" onClick={onClose} aria-label="鍏抽棴">鉁?/button>
            </div>
          </div>
        </div>
        <div className="wk-mp__scroll">
          <div className="wk-mp-empty">閫夋嫨涓€涓簨椤规煡鐪嬭鎯?/div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wk-mp">
        <div className="wk-mp-head">
          <div className="wk-mp-head__row1">
            <span className="wk-mp-head__id">鍔犺浇涓?..</span>
            <div className="wk-mp-head__actions">
              <button type="button" className="wk-mp-head__close" onClick={onClose} aria-label="鍏抽棴">鉁?/button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className="wk-mp">
        <div className="wk-mp-head">
          <div className="wk-mp-head__row1">
            <span className="wk-mp-head__id">浜嬮」</span>
            <div className="wk-mp-head__actions">
              <button type="button" className="wk-mp-head__close" onClick={onClose} aria-label="鍏抽棴">鉁?/button>
            </div>
          </div>
        </div>
        <div className="wk-mp__scroll">
          <div className="wk-mp-empty">{error || '浜嬮」涓嶅瓨鍦?}</div>
        </div>
      </div>
    );
  }

  const channels = matter.channels || [];
  const assignees = matter.assignees || [];

  const tabs: { id: TabKey; label: string; count: number }[] = [
    { id: 'channels', label: '鍏宠仈缇よ亰', count: channels.length },
    { id: 'outputs', label: '浜у嚭鏂囦欢', count: 0 },
    { id: 'changelog', label: '鍙樻洿璁板綍', count: 0 },
  ];

  return (
    <div className="wk-mp">
      {/* Head */}
      <div className="wk-mp-head">
        <div className="wk-mp-head__row1">
          <span className="wk-mp-head__id">{matter.id.slice(0, 8)}</span>
          <StatusPicker status={matter.status} onChange={handleStatusChange} />
          {matter.deadline && (
            <span className="wk-mp-head__ddl">
              <span className="wk-mp-head__ddl-label">鎴</span>
              <span className="wk-mp-head__ddl-value">{new Date(matter.deadline).toLocaleDateString('zh-CN')}</span>
            </span>
          )}
          <div className="wk-mp-head__actions">
            <button type="button" className="wk-mp-head__close" onClick={onClose} aria-label="鍏抽棴">鉁?/button>
          </div>
        </div>
        <h2 className="wk-mp-head__title">{matter.title}</h2>
        <div className="wk-mp-head__meta">
          <span>鍒涘缓: {matter.creator_id.slice(0, 8)}</span>
          {assignees.length > 0 && (
            <span> 路 璐熻矗: {assignees.map((a) => a.user_id.slice(0, 8)).join(', ')}</span>
          )}
          {matter.source_name && <span> 路 #{matter.source_name}</span>}
        </div>
      </div>

      {/* 涓昏鐩爣 */}
      {matter.description && (
        <div className="wk-mp-goal">
          <div className="wk-mp-goal__label">涓昏鐩爣</div>
          <div className="wk-mp-goal__text">{matter.description}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="wk-mp-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`wk-mp-tabs__item${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count > 0 && <span className="wk-mp-tabs__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="wk-mp__scroll">
        {tab === 'channels' && (
          <div className="wk-mp-tab-content">
            {channels.length === 0 ? (
              <div className="wk-mp-empty">鏆傛棤鍏宠仈缇よ亰</div>
            ) : (
              channels.map((ch) => (
                <div key={ch.id} className="wk-mp-channel-item">
                  <span className="wk-mp-channel-item__name">#{ch.channel_name || ch.channel_id}</span>
                  <span className="wk-mp-channel-item__type">
                    {ch.channel_type === 2 ? '缇ょ粍' : ch.channel_type === 1 ? '绉佽亰' : '瀛愬尯'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'outputs' && (
          <div className="wk-mp-tab-content">
            <div className="wk-mp-empty">浜у嚭鏂囦欢鍔熻兘鍗冲皢涓婄嚎</div>
          </div>
        )}
        {tab === 'changelog' && (
          <div className="wk-mp-tab-content">
            <div className="wk-mp-empty">鍙樻洿璁板綍鍔熻兘鍗冲皢涓婄嚎</div>
          </div>
        )}
      </div>
    </div>
  );
}

export { MatterDetailPanel };

// 鈹€鈹€鈹€ StatusPicker 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const STATUS_OPTIONS: { value: MatterStatus; label: string }[] = [
  { value: 'open', label: '杩涜涓? },
  { value: 'done', label: '宸插畬鎴? },
  { value: 'archived', label: '宸插綊妗? },
];

function StatusPicker({ status, onChange }: { status: MatterStatus; onChange: (s: MatterStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const current = STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[0];

  return (
    <div className="wk-mp-status-picker" ref={ref}>
      <button
        type="button"
        className={`wk-mp-status-picker__btn wk-mp-status-picker__btn--${status}`}
        onClick={() => setOpen(!open)}
      >
        <span className="wk-mp-status-picker__dot" />
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="wk-mp-status-picker__dropdown">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`wk-mp-status-picker__option${opt.value === status ? ' is-active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span className={`wk-mp-status-picker__dot wk-mp-status-picker__dot--${opt.value}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
