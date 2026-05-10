// Aegis「去认证」入口 URL 解析器。独立 leaf 文件不依赖 React / lottie / wukongimjssdk
// 等重模块, 让 vitest 可以直接深路径 import 做边界单测（不被 MeInfo vm.tsx 的
// 一堆副作用 import 拖下水）。
//
// 业务背景（YUJ-396 / GH #1174）：
//   Phase 2a/2b/2c 三端 PR 把 Aegis verification URL 硬编码成 prod 域
//   `https://accounts.xming.ai/profile/info?anchor=verification`。im-test
//   实机测试时「去认证」按钮会把用户甩到 prod Aegis；im-test 环境正确域名是
//   `accounts-test.imocto.cn`。
//
//   后端早已按环境下发了正确域名：`/v1/common/appconfig` 的
//   `oidc_providers[].account_url` 字段 —— im-test 返 `accounts-test.imocto.cn`,
//   im-prod 返 `accounts.xming.ai`。Web 端 NavSettingsPanel「账户中心」入口
//   已经在走这条链, 是前端既有正路。这里把「去认证」入口也迁到同一条链上。

import type { OidcProviderConfig } from "../../Service/OidcConfig";

/** 固定 fragment / query 锚点, 定向到 Aegis 账户页里的「实名认证」section。 */
const AEGIS_VERIFY_ANCHOR_PATH = "/profile/info?anchor=verification";

export type ResolveRealnameVerifyUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "no_login_provider" | "local_account" | "no_account_url" };

/**
 * 按登录用户的 OIDC provider id 在后端下发的 oidc_providers 里找对应 account_url,
 * 拼成 Aegis 实名认证入口 URL。
 *
 * 行为合约（覆盖 YUJ-396 四个分支）:
 *   1. provider 配了 account_url  → ok + 拼好的 URL
 *   2. provider 无 account_url     → no_account_url（前端应 toast 不跳）
 *   3. loginProvider 是 local / 空 → local_account / no_login_provider（不跳转）
 *   4. provider id 不在 oidcProviders 里 → no_account_url（不跳转）
 *
 * 绝不引入 prod 域常量 / 测试域常量兜底 —— 这是本函数存在的唯一理由:
 * 让「去认证」的环境感知 100% 走后端 appconfig 下发, 与 NavSettingsPanel
 * 「账户中心」入口口径统一。
 *
 * accountUrl 末尾斜杠去重（`replace(/\/+$/,'')`）是为了防 backend 下发
 * `https://accounts-test.imocto.cn/` 导致最终拼出 `//profile/info?...` 这种
 * 协议相对 URL（浏览器会当 `https://profile/...` 的站点跳）。
 */
export function resolveRealnameVerifyUrl(
  loginProvider: string | undefined | null,
  oidcProviders: readonly OidcProviderConfig[] | undefined | null,
): ResolveRealnameVerifyUrlResult {
  if (typeof loginProvider !== "string" || loginProvider.length === 0) {
    return { ok: false, reason: "no_login_provider" };
  }
  if (loginProvider === "local") {
    return { ok: false, reason: "local_account" };
  }
  const providers = Array.isArray(oidcProviders) ? oidcProviders : [];
  const provider = providers.find((p) => p && p.id === loginProvider);
  const accountUrl = provider?.accountUrl;
  if (typeof accountUrl !== "string" || accountUrl.length === 0) {
    return { ok: false, reason: "no_account_url" };
  }
  const base = accountUrl.replace(/\/+$/, "");
  return { ok: true, url: `${base}${AEGIS_VERIFY_ANCHOR_PATH}` };
}
