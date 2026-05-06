import React, { useEffect, useState } from "react"
import { Channel, ChannelTypePerson } from "wukongimjssdk"
import { WKApp } from "@octo/base"
import "./AppBotList.css"

interface AppBotInfo {
  id: string
  uid: string
  display_name: string
  description: string
  avatar: string
  scope: "platform" | "space"
}

export default function AppBotList() {
  const [bots, setBots] = useState<AppBotInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const spaceId = WKApp.shared.currentSpaceId
      const params = spaceId ? { param: { space_id: spaceId } } : undefined
      const res = await WKApp.apiClient.get("/app_bot/available", params)
      setBots(res || [])
    } catch (err) {
      console.warn('[AppBotList] Failed to load bots:', err)
      setError('加载失败，请稍后重试')
      setBots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handler = () => loadData()
    WKApp.mittBus.on("space-changed", handler)
    return () => { WKApp.mittBus.off("space-changed", handler) }
  }, [])

  const openChat = (bot: AppBotInfo) => {
    WKApp.endpoints.showConversation(new Channel(bot.uid, ChannelTypePerson))
  }

  if (loading) {
    return <div className="appbot-page"><div className="appbot-loading">加载中...</div></div>
  }

  if (error) {
    return (
      <div className="appbot-page">
        <div className="appbot-empty">
          <div className="appbot-empty-icon">⚠️</div>
          <div className="appbot-empty-text">{error}</div>
          <button className="appbot-retry-btn" onClick={loadData}>重试</button>
        </div>
      </div>
    )
  }

  if (bots.length === 0) {
    return (
      <div className="appbot-page">
        <div className="appbot-empty">
          <div className="appbot-empty-icon">📦</div>
          <div className="appbot-empty-text">暂无可用应用</div>
        </div>
      </div>
    )
  }

  return (
    <div className="appbot-page">
      <div className="appbot-header">应用</div>
      <div className="appbot-list">
        {bots.map((bot) => (
          <div key={bot.id} className="appbot-item" onClick={() => openChat(bot)}>
            <div className="appbot-avatar">
              {bot.avatar
                ? <img src={bot.avatar} alt={bot.display_name} />
                : <span>{bot.display_name?.charAt(0)?.toUpperCase() || "A"}</span>
              }
            </div>
            <div className="appbot-info">
              <div className="appbot-name">{bot.display_name}</div>
              {bot.description && <div className="appbot-desc">{bot.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
