---
title: "独立 App 开发者：如何托管隐私政策和用户协议"
description: "记录一次为独立 App 准备 GitHub Pages 法律页面的实战流程，包括双语隐私政策、用户协议、同步脚本和上架 URL 规划。"
pubDate: 2026-05-05
draft: false
readingTime: 8
tags: ["独立开发", "Google Play", "GitHub Pages", "隐私政策"]
lang: "zh-CN"
---

> 标签：独立开发 / Google Play / GitHub Pages / 隐私政策  
> 预计阅读：8 分钟

做独立 App 的 MVP 时，很多人会把注意力放在功能、UI、构建和上架文案上。但只要你准备上 Google Play，隐私政策、用户协议、Data safety 这些“非功能项”很快就会变成硬需求。

我这次做 TickFloat 的过程里，把这件事标准化了一下：每个新 App 不再临时手写一个隐私政策页面，也不把法律文案塞在主工程里等着以后想办法托管，而是在 MVP 阶段就准备一套可直接发布到 GitHub Pages 的静态页面，并提供同步脚本。

这篇文章记录的是实际落地方式，其他独立开发者也可以直接照着做。

## 背景：为什么要单独托管法律页面

TickFloat 是一个 Android 悬浮时钟与倒计时工具。它会申请悬浮窗权限，用前台服务保持悬浮窗运行，但它不读屏、不使用无障碍服务、不自动点击、不上传用户数据。

这类工具虽然功能很轻，但上架时仍然需要清楚说明：

- 为什么需要悬浮窗权限。
- 是否读取其他 App 内容。
- 是否使用 Accessibility Service。
- 是否上传个人数据。
- 是否接入广告、内购、分析 SDK。
- 用户如何删除本地数据。

这些内容不适合只写在 README 里。Google Play 需要一个公开可访问的隐私政策 URL，用户也应该能从 App 内打开这些页面。

所以我采用了一个很轻的方案：用 GitHub Pages 托管静态 HTML。

## 目标结构

我为 TickFloat 准备了一个单独的 public 仓库，例如：

```text
tickfloat-legal
```

最终 GitHub Pages 仓库结构是：

```text
tickfloat-legal/
  index.html
  user-agreement.html
  privacy-policy.html
  en/
    index.html
    user-agreement.html
    privacy-policy.html
  zh-CN/
    index.html
    user-agreement.html
    privacy-policy.html
```

这里有两个设计点：

第一，根目录保留英文版 `privacy-policy.html`，给 Google Play 填写隐私政策 URL 时最稳。

第二，显式提供 `zh-CN/` 和 `en/` 两套路径。App 默认中文时，可以直接打开中文 URL；英文系统语言下，可以打开英文 URL。

例如：

```text
https://magic-xu.github.io/tickfloat-legal/privacy-policy.html
https://magic-xu.github.io/tickfloat-legal/zh-CN/privacy-policy.html
https://magic-xu.github.io/tickfloat-legal/zh-CN/user-agreement.html
```

## 在主工程里维护源文件

我没有直接在 legal 仓库里编辑页面，而是在 App 主工程里维护源文件：

```text
TickFloat/
  docs/
    github-pages/
      index.html
      user-agreement.html
      privacy-policy.html
      en/
        index.html
        user-agreement.html
        privacy-policy.html
      zh-CN/
        index.html
        user-agreement.html
        privacy-policy.html
```

原因很简单：法律页面和 App 能力强相关。

比如 TickFloat 现在不接入广告、不接入 Billing、不上传数据、不使用无障碍服务。如果未来某个版本加入广告或 Pro Unlock，隐私政策必须和代码一起更新。把源文件放在 App 工程里，更容易在一次功能改动中同步检查。

## 写一个同步脚本

为了避免每次手动复制，我加了一个脚本：

```text
scripts/sync_legal_pages.sh
```

默认同步到：

```text
/Users/magic/Desktop/reborn/tickfloat-legal
```

使用方式：

```bash
./scripts/sync_legal_pages.sh
```

也可以传入其他目标路径：

```bash
./scripts/sync_legal_pages.sh /path/to/tickfloat-legal
```

脚本只覆盖指定的 HTML 文件和语言目录，不删除目标仓库里的 `.git`、README 或其他文件。这样同步完之后，直接进入 legal 仓库提交即可：

```bash
cd /Users/magic/Desktop/reborn/tickfloat-legal
git status
git add .
git commit -m "Update TickFloat legal pages"
git push
```

## GitHub Pages 怎么开

把 legal 仓库 push 到 GitHub 后，在仓库页面：

1. 进入 `Settings`
2. 找到 `Pages`
3. `Source` 选择 `Deploy from a branch`
4. `Branch` 选择 `main`
5. `Folder` 选择 `/root`
6. 保存

几分钟后，GitHub 会生成类似这样的地址：

```text
https://magic-xu.github.io/tickfloat-legal/
```

如果你的 GitHub 用户名是 `Magic-Xu`，仓库名是 `tickfloat-legal`，最终一般是：

```text
https://magic-xu.github.io/tickfloat-legal/privacy-policy.html
```

GitHub Pages URL 通常会把用户名转成小写，不影响访问。

## 法律页面应该写什么

我的经验是，MVP 阶段不要写得像大公司模板，也不要遗漏产品边界。

TickFloat 的页面重点写了这些：

- App 是悬浮时钟和倒计时工具。
- 需要悬浮窗权限是为了在其他 App 上方显示时间。
- Android 13+ 可能需要通知权限，用于前台服务通知。
- 不读取其他 App 内容。
- 不使用 Accessibility Service。
- 不使用 Usage Access。
- 不自动点击，不自动执行第三方 App 操作。
- MVP 不接入广告 SDK、Billing、订阅或分析 SDK。
- 设置仅保存在本机。
- 用户可以通过清除 App 存储或卸载 App 删除本地数据。

这套描述和代码能力必须一致。比如你未来真的接入 AdMob，就不能继续写“不包含广告 SDK”。

## App 内怎么接

TickFloat 当前设置页里已经有“用户协议”和“隐私政策”入口文案。下一步可以把它们改成可点击项，根据系统语言打开不同 URL：

中文默认：

```text
https://magic-xu.github.io/tickfloat-legal/zh-CN/privacy-policy.html
https://magic-xu.github.io/tickfloat-legal/zh-CN/user-agreement.html
```

英文：

```text
https://magic-xu.github.io/tickfloat-legal/en/privacy-policy.html
https://magic-xu.github.io/tickfloat-legal/en/user-agreement.html
```

Google Play Console 里的隐私政策 URL 建议填根目录英文版：

```text
https://magic-xu.github.io/tickfloat-legal/privacy-policy.html
```

## 这件事为什么值得标准化

独立开发者做多个小 App 时，很容易每次都重复这些事：

- 重新想隐私政策放哪里。
- 临时写一个 HTML。
- 忘记双语。
- 忘记 Google Play 要 HTTPS URL。
- 忘记 App 内入口。
- 后续功能变化后，法律文案不同步。

这次我把流程固定成：

```text
主工程维护源 HTML
  -> 同步脚本复制到 legal 仓库
  -> legal 仓库 GitHub Pages 发布
  -> App 和 Google Play 使用固定 URL
```

这不是复杂架构，但非常适合独立 App MVP。它足够轻，也足够可维护。

## 可复用清单

每开一个新 App，我建议直接检查这几项：

- 是否有 `docs/github-pages/`。
- 是否有英文根路径隐私政策。
- 是否有 `en/` 和 `zh-CN/`。
- 是否有同步脚本。
- 是否有 GitHub Pages 仓库。
- App 设置页是否有用户协议和隐私政策入口。
- Google Play 隐私政策 URL 是否可公开访问。
- 隐私政策内容是否和当前 App 权限、SDK、数据行为一致。

这套流程做完，法律页面就不再是每次上架前临时补的东西，而是 App 工程的一部分。
