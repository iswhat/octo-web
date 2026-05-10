import { describe, it, expect } from "vitest"
import { resolveRealnameVerifyUrl } from "../realnameVerifyUrl"
import type { OidcProviderConfig } from "../../../Service/OidcConfig"

/**
 * YUJ-396 — Web 端「去认证」入口 URL 解析器单测。
 *
 * 把 Aegis verification URL 的拼接逻辑从 vm.tsx 里抽出来, 用纯函数锁住行为合约:
 *   1. provider 有 account_url → 拼 `${accountUrl}/profile/info?anchor=verification`
 *   2. provider 有但 account_url 缺失 → no_account_url（vm.tsx 会 toast 不跳）
 *   3. loginProvider=local / 空 → local_account / no_login_provider（不跳）
 *   4. provider id 在 oidcProviders 里查不到 → no_account_url（不跳）
 *
 * 任何把 prod 域 / test 域硬编码兜底的 regression 都应该挂掉这个 suite。
 */

const aegisProdProvider: OidcProviderConfig = {
  id: "xming",
  name: "xming",
  authorizePath: "/auth/oidc/xming/authorize",
  accountUrl: "https://accounts.xming.ai",
}

const aegisTestProvider: OidcProviderConfig = {
  id: "xming",
  name: "xming",
  authorizePath: "/auth/oidc/xming/authorize",
  accountUrl: "https://accounts-test.imocto.cn",
}

const octoProvider: OidcProviderConfig = {
  id: "octo",
  name: "octo",
  authorizePath: "/auth/oidc/octo/authorize",
  accountUrl: "https://accounts-octo.example/",
}

describe("resolveRealnameVerifyUrl", () => {
  it("returns the prod Aegis verify URL when provider matches prod account_url", () => {
    const res = resolveRealnameVerifyUrl("xming", [aegisProdProvider])
    expect(res).toEqual({
      ok: true,
      url: "https://accounts.xming.ai/profile/info?anchor=verification",
    })
  })

  it("returns the test Aegis verify URL when provider matches test account_url (im-test)", () => {
    const res = resolveRealnameVerifyUrl("xming", [aegisTestProvider])
    expect(res).toEqual({
      ok: true,
      url: "https://accounts-test.imocto.cn/profile/info?anchor=verification",
    })
  })

  it("strips trailing slashes on accountUrl to avoid `//profile/...` protocol-relative leak", () => {
    const res = resolveRealnameVerifyUrl("octo", [octoProvider])
    expect(res).toEqual({
      ok: true,
      url: "https://accounts-octo.example/profile/info?anchor=verification",
    })
  })

  it("returns no_account_url when the matched provider has no accountUrl (legacy appconfig, absent account_url)", () => {
    const provider: OidcProviderConfig = {
      id: "xming",
      name: "xming",
      authorizePath: "/auth/oidc/xming/authorize",
      // accountUrl intentionally omitted
    }
    const res = resolveRealnameVerifyUrl("xming", [provider])
    expect(res).toEqual({ ok: false, reason: "no_account_url" })
  })

  it("returns local_account when loginProvider === 'local'", () => {
    const res = resolveRealnameVerifyUrl("local", [aegisProdProvider])
    expect(res).toEqual({ ok: false, reason: "local_account" })
  })

  it("returns no_login_provider when loginProvider is an empty string", () => {
    const res = resolveRealnameVerifyUrl("", [aegisProdProvider])
    expect(res).toEqual({ ok: false, reason: "no_login_provider" })
  })

  it("returns no_login_provider when loginProvider is undefined", () => {
    const res = resolveRealnameVerifyUrl(undefined, [aegisProdProvider])
    expect(res).toEqual({ ok: false, reason: "no_login_provider" })
  })

  it("returns no_account_url when provider id does not match anything in oidcProviders", () => {
    // 用户登录用的 provider `xming` 被后端下掉了（只剩 octo）—— 不能回退到
    // 随便一个 provider 的 account_url, 这会把用户甩到错的账户中心域名。
    const res = resolveRealnameVerifyUrl("xming", [octoProvider])
    expect(res).toEqual({ ok: false, reason: "no_account_url" })
  })

  it("returns no_account_url when oidcProviders is empty", () => {
    const res = resolveRealnameVerifyUrl("xming", [])
    expect(res).toEqual({ ok: false, reason: "no_account_url" })
  })

  it("treats a null/undefined oidcProviders array as empty (no_account_url)", () => {
    // 冷启动 appconfig 未到时 WKApp.remoteConfig.oidcProviders 可能还是
    // 默认值 [], 但防御 null/undefined 传入同样走 no_account_url 分支。
    expect(resolveRealnameVerifyUrl("xming", undefined)).toEqual({
      ok: false,
      reason: "no_account_url",
    })
    expect(resolveRealnameVerifyUrl("xming", null)).toEqual({
      ok: false,
      reason: "no_account_url",
    })
  })
})
