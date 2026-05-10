import React from "react";
import QRCodeMy from "../QRCodeMy";
import WKApp from "../../App";
import RouteContext, { FinishButtonContext, RouteContextConfig } from "../../Service/Context";
import { ProviderListener } from "../../Service/Provider";
import { Row, Section } from "../../Service/Section";
import { InputEdit } from "../InputEdit";
import { ListItem, ListItemIcon } from "../ListItem";
import { Sex, SexSelect } from "../SexSelect";
import { ListItemAvatar } from "../ListItemAvatar";
import RealnameVerifiedBadge from "../RealnameVerifiedBadge";
import axios from "axios";
import { Toast } from "@douyinfe/semi-ui";
import WKSDK, { Channel } from "wukongimjssdk";
import { ChannelInfoListener } from "wukongimjssdk";
import { ChannelInfo, ChannelTypePerson } from "wukongimjssdk";
import { Convert } from "../../Service/Convert";
import { isRealnameVerified } from "../../Utils/displayName";
import { resolveRealnameVerifyUrl } from "./realnameVerifyUrl";

/**
 * MeInfoVM — 自己的「个人信息 / 设置」页面 ViewModel
 *
 * YUJ-359 / GH #1121 接入实名认证。
 * YUJ-391 / Aegis Phase 2a：「去认证」入口改为直跳 Aegis 账户页, 不再调用
 *   verify-service 翻译接口。
 * YUJ-396 / GH #1174：Aegis 域名改为按环境从后端 appconfig 下发的
 *   `oidc_providers[].account_url` 字段读, 而非硬编码 prod URL。
 *   im-test 会拿到 `accounts-test.imocto.cn`, im-prod 拿到 `accounts.xming.ai`,
 *   和 NavSettingsPanel 「账户中心」入口口径一致。
 *
 *   - 「名字」行右侧展示 ✓ + 「已实名」tag（已认证）
 *   - 新增「账号安全 · 实名认证」section
 *     · 已认证：展示 「已认证 · {年-月}」不可点
 *     · 未认证：展示「去认证」CTA，点击 `window.open(<account_url>/profile/info?anchor=verification, '_blank')`
 *       直接跳到 Aegis 账户页的实名认证锚点。
 *   - Aegis 完成认证后会以 `return_to` 带 `?verified=1` 回跳，由本 VM 的
 *     didMount 兜底 handler + 全局 useRealnameVerifiedLandingHandler 捕获，
 *     重新 `reloadSelfProfile()` 同步新状态。
 *   - 老版本后端兜底仍保留：dmworkim /v1/internal/verify-token 现在返回的
 *     也是按环境下发的 Aegis URL，老 App 客户端无需改动即可工作。
 */
export class MeInfoVM extends ProviderListener {

    channelInfoListener!:ChannelInfoListener
    /** YUJ-359：本页加载时主动拉取的自身 profile（含 realname_verified / real_name） */
    selfChannelInfo?: ChannelInfo

    didMount(): void {
        this.channelInfoListener = (channelInfo:ChannelInfo)=>{
            if(channelInfo.channel.channelType !== ChannelTypePerson) {
                return
            }
            if(channelInfo.channel.channelID !== WKApp.loginInfo.uid) {
                return
            }
            WKApp.loginInfo.name = channelInfo.title;
            WKApp.loginInfo.shortNo = channelInfo.orgData.short_no;
            WKApp.loginInfo.sex = channelInfo.orgData.sex;
            this.syncRealnameFromOrgData(channelInfo.orgData)
            WKApp.shared.myUserAvatarChange()
            this.selfChannelInfo = channelInfo
            this.notifyListener()
        }
        WKSDK.shared().channelManager.addListener(this.channelInfoListener)

        // YUJ-359: 主动拉一次 /users/{uid} 保证进入本页时 realname_verified / real_name
        // 是最新状态（channelInfoListener 只在后续有变更时才会触发）。
        this.reloadSelfProfile()

        // 用户从 Aegis 认证流程返回（Aegis 会按 `return_to` 带 ?verified=1 回跳，
        // 老 dmwork:// deeplink / verify-service 回跳也都归一化到 ?verified=1），
        // 在此页再拉一次 profile 并主动清除 URL 里的 verified 参数，
        // 避免二次进入时误触发刷新。
        try {
            const params = new URLSearchParams(window.location.search)
            if (params.get("verified") === "1") {
                params.delete("verified")
                const rest = params.toString()
                const url = window.location.pathname + (rest ? ("?" + rest) : "") + window.location.hash
                window.history.replaceState(null, "", url)
                // 再拉一次以保证刚认证完状态立即刷新
                this.reloadSelfProfile()
            }
        } catch (e) {
            // URL API 在非浏览器环境下可能不可用 — 静默降级，不阻塞页面
        }
    }

    didUnMount(): void {
        WKSDK.shared().channelManager.removeListener(this.channelInfoListener)
    }

    /**
     * YUJ-359：把 profile orgData 里的实名字段回写到 WKApp.loginInfo（方便跨页面快速判定）。
     * 硬约束：仅处理 realname_verified / real_name 两个字段，不扩散其他字段到 loginInfo。
     */
    private syncRealnameFromOrgData(orgData: any) {
        const verified = isRealnameVerified(orgData)
        WKApp.loginInfo.realnameVerified = verified
        if (verified && typeof orgData?.real_name === "string" && orgData.real_name.length > 0) {
            WKApp.loginInfo.realName = orgData.real_name
        } else {
            WKApp.loginInfo.realName = undefined
        }
        const verifiedAt = orgData?.realname_verified_at
        if (typeof verifiedAt === "number" && verifiedAt > 0) {
            WKApp.loginInfo.realnameVerifiedAt = verifiedAt
        }
        WKApp.loginInfo.save()
    }

    async reloadSelfProfile() {
        const uid = WKApp.loginInfo.uid
        if (!uid) return
        try {
            const res = await WKApp.apiClient.get<any>(`users/${uid}`)
            const channelInfo = Convert.userToChannelInfo(res)
            this.selfChannelInfo = channelInfo
            this.syncRealnameFromOrgData(channelInfo.orgData)
            this.notifyListener()
        } catch (e: any) {
            // 个人页拉取失败不打断渲染（仍然有 loginInfo 的缓存字段），仅静默
            // 控制台打印以便排查
            // eslint-disable-next-line no-console
            console.warn("[MeInfoVM] reloadSelfProfile failed", e)
        }
    }

    /**
     * YUJ-391 / Aegis Phase 2a：「去认证」入口直跳 Aegis 账户页。
     * YUJ-396 / GH #1174：Aegis 域名改为按环境从后端 appconfig 下发的
     *   `oidc_providers[].account_url` 读, 不再硬编码 prod URL。
     *
     * 不再调用 dmworkim `/v1/internal/verify-token` 翻译接口 —— Web 端直接
     * `window.open` 到 Aegis 的实名认证锚点。Aegis 完成后会 redirect 回
     * 本页（带 ?verified=1），由 didMount 的兜底 handler + 全局
     * useRealnameVerifiedLandingHandler 触发 reloadSelfProfile 同步状态。
     *
     * URL 解析口径（resolveRealnameVerifyUrl）：
     *   - 按 loginInfo.loginProvider 在 remoteConfig.oidcProviders 里查
     *     对应 provider 的 accountUrl, 拼 `${accountUrl}/profile/info?anchor=verification`。
     *     与 NavSettingsPanel「账户中心」入口口径一致（accounts-test.imocto.cn
     *     on im-test / accounts.xming.ai on im-prod, 后端下发）。
     *   - loginProvider=local / 空 / provider 无 account_url / provider 不在
     *     下发列表里 → Toast 明示, 不跳转。严禁回退到任何硬编码 prod 域。
     *
     * 兜底：弹窗被浏览器拦截时降级为当前 tab 跳转，确保认证流程能走下去。
     *
     * 老 App 兜底：dmworkim 的 verify-token 接口仍然保留，只是现在返回
     * 按环境下发的 Aegis URL，老版本客户端无需改动。
     */
    startRealnameVerify() {
        // 读按环境下发的 account_url —— 防止把 im-test 用户甩到 prod Aegis。
        // 具体行为合约见 resolveRealnameVerifyUrl 的 JSDoc 和 __tests__/realnameVerifyUrl.test.ts。
        const resolved = resolveRealnameVerifyUrl(
            WKApp.loginInfo.loginProvider,
            WKApp.remoteConfig.oidcProviders,
        )
        if (!resolved.ok) {
            switch (resolved.reason) {
                case "no_login_provider":
                    // 理论上到这里时用户已经登录；空 provider 一般是 SID 存储格式历史遗留,
                    // 展示同 local 的提示即可,引导用户联系管理员。
                case "local_account":
                    Toast.error("当前账号不支持在线实名认证，请联系管理员")
                    break
                case "no_account_url":
                    // appconfig 没下发对应 provider 的 account_url：要么配置漏了,
                    // 要么用户登录用的 provider 已被后端下掉。兜底 Toast, 不跳 prod。
                    Toast.error("当前环境未配置实名认证入口，请稍后再试或联系管理员")
                    break
            }
            return
        }
        const verifyUrl = resolved.url
        // 新 tab 打开，noopener 防止 Aegis 反操作当前窗口
        const opened = window.open(verifyUrl, "_blank", "noopener,noreferrer")
        if (!opened) {
            // 弹窗被浏览器拦截时降级为当前 tab 跳转
            window.location.href = verifyUrl
        }
    }

    uploadAvatar(file: File) {
        const param = new FormData();
        param.append("file", file);
        return axios.post(`users/${WKApp.loginInfo.uid}/avatar`, param, {
            headers: { "Content-Type": "multipart/form-data", "token": WKApp.loginInfo.token || "" },
        }).catch(error => {
        })
    }

    updateMyInfo(field: string, value: string) {
        let param: any = {}
        param[field] = value
        return WKApp.apiClient.put("user/current", param).catch((err) => {
            Toast.error(err.msg)
        })
    }

    inputEditPush(context: RouteContext<any>, defaultValue: string, onFinish: (value: string) => Promise<void>, placeholder?: string,maxCount?:number) {
        let value: string
        let finishButtonContext: FinishButtonContext
        context.push(<InputEdit maxCount={maxCount} defaultValue={defaultValue} placeholder={placeholder} onChange={(v) => {
            value = v
            if (!value || value === "") {
                finishButtonContext.disable(true)
            } else {
                finishButtonContext.disable(false)
            }
        }}></InputEdit>, new RouteContextConfig({
            showFinishButton: true,
            onFinishContext: (finishBtnContext) => {
                finishButtonContext = finishBtnContext
                finishBtnContext.disable(true)
            },
            onFinish: async () => {
                finishButtonContext.loading(true)
                await onFinish(value)
                finishButtonContext.loading(false)

                context.pop()
            }
        }))
    }

    /**
     * YUJ-359：「名字」行的 subTitle — 已认证时展示 「昵称 ✓ 已实名」，
     * 未认证时退化为普通昵称字符串。
     */
    private nameRowSubTitle(): React.ReactNode {
        const name = WKApp.loginInfo.name || ""
        if (!WKApp.loginInfo.realnameVerified) {
            return name
        }
        return (
            <span style={{ display: "inline-flex", alignItems: "center" }}>
                {WKApp.loginInfo.realName || name}
                <RealnameVerifiedBadge />
            </span>
        )
    }

    /**
     * YUJ-359：格式化「已认证 · 2025-03」展示文本。
     * verified_at 字段后端若缺失，只展示「已认证」不拼年月，避免显示 NaN。
     */
    private formatVerifiedAtLabel(): string {
        const ts = WKApp.loginInfo.realnameVerifiedAt
        if (!ts || typeof ts !== "number" || ts <= 0) {
            return "已认证"
        }
        // 后端通常发秒级时间戳，兼容毫秒
        const ms = ts > 10_000_000_000 ? ts : ts * 1000
        const d = new Date(ms)
        if (Number.isNaN(d.getTime())) {
            return "已认证"
        }
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, "0")
        return `已认证 · ${yyyy}-${mm}`
    }

    sections(context: RouteContext<any>) {

        let sections = new Array<Section>()
        sections.push(new Section({
            rows: [
                new Row({
                    cell: ListItemAvatar,
                    properties: {
                        title: `头像`,
                        context: context,
                        avatar: <img style={{ "width": "24px", "height": "24px", "borderRadius": "50%" }} src={WKApp.shared.avatarUser(WKApp.loginInfo.uid || "")}></img>,
                        onFileUpload: async (f: File) => {
                            await this.uploadAvatar(f)
                            WKApp.shared.changeChannelAvatarTag(new Channel(WKApp.loginInfo.uid||"", ChannelTypePerson))
                        }
                    }
                }),
                new Row({
                    cell: ListItem,
                    properties: {
                        title: "名字",
                        subTitle: this.nameRowSubTitle(),
                        onClick: () => {
                            this.inputEditPush(context, WKApp.loginInfo.name || "", async (value) => {
                                if (value.trim() === "") {
                                    Toast.error("名字不能为空！")
                                    return
                                }
                                return this.updateMyInfo("name",value).then(()=>{
                                    WKApp.loginInfo.name = value
                                    WKApp.loginInfo.save()
                                })
                            }, "设置名字",20)
                        }
                    }
                }),
                new Row({
                    cell: ListItem,
                    properties: {
                        title: `${WKApp.config.appName}号`,
                        subTitle: WKApp.loginInfo.shortNo,
                        onClick: () => {

                        }
                    }
                }),
                new Row({
                    cell: ListItemIcon,
                    properties: {
                        title: `我的二维码`,
                        icon: <img style={{ "width": "24px", "height": "24px" }} src={require("./../../assets/icon_qrcode.png")}></img>,
                        onClick: () => {
                            context.push(<QRCodeMy disableHeader={true}></QRCodeMy>)
                        }
                    }
                })
            ]
        }))

        let sex = WKApp.loginInfo.sex === 0 ? Sex.Female : Sex.Male
        let sexStr = "男"
        if (sex === Sex.Female) {
            sexStr = "女"
        }

        sections.push(new Section({
            rows: [
                new Row({
                    cell: ListItem,
                    properties: {
                        title: "性别",
                        subTitle: sexStr,
                        onClick: () => {
                            context.push(<SexSelect sex={sex} onSelect={ async (sex) => {
                                this.updateMyInfo("sex",sex.toString())
                                context.pop()
                                WKApp.loginInfo.sex = sex
                                WKApp.loginInfo.save()
                            }}></SexSelect>)
                        }
                    }
                }),
            ]
        }))

        // YUJ-359：账号安全 · 实名认证。
        // YUJ-391 / Aegis Phase 2a：未认证点击直跳 Aegis 账户页。
        const verified = !!WKApp.loginInfo.realnameVerified
        sections.push(new Section({
            title: "账号安全",
            rows: [
                new Row({
                    cell: ListItem,
                    properties: {
                        title: "实名认证",
                        subTitle: verified
                            ? this.formatVerifiedAtLabel()
                            : "去认证",
                        onClick: () => {
                            if (verified) return
                            this.startRealnameVerify()
                        }
                    }
                })
            ]
        }))

        return sections
    }
}
