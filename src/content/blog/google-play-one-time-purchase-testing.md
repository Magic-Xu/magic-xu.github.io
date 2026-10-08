---
title: "独立 App 开发系列：Google Play 一次性内购接入实践"
description: "以 SnapMosaic 永久 Pro 为例，记录 Google Play 一次性内购的接入、管理后台配置、测试与验收，以及价格和购买状态的常见问题。附接入提示词、操作截图和检查方法。"
pubDate: 2026-09-08
draft: false
readingTime: 10
tags: ["独立开发", "Android", "Google Play", "AI", "应用内购买"]
lang: "zh-CN"
---

**适用读者：** 准备给 Android App 接入 Google Play 内购，或正在配置和测试一次性付费功能的开发者。

**文章收获：** 看懂商品和测试账号的配置，知道购买后该检查什么，也能排查价格和购买状态的问题。附接入提示词和操作截图。

**一句话总结：** 内购接入涉及 App、管理后台和测试账号，购买完成后还要实际检查付费功能是否生效。

## 1. 支付内购的接入

这次，我给 SnapMosaic 加了永久 Pro：用户购买一次，就能去掉广告和导出图片上的品牌水印。这种买完后可以一直使用、不会被消耗掉的权益，对应 Google Play 的**非消耗型一次性商品**。

Google Play 的 Billing SDK 已经提供了商品与价格查询、购买支付、购买状态查询，以及恢复购买所需的能力，不需要从头实现。

这部分代码我是用 AI 完成的。接入时，可以先告诉它卖什么、买完能获得什么，再让它按项目现有的架构实现。下面这段提示词可以作为参考，商品 ID 和权益需要换成自己的。

<div data-copyable-prompt>

```text
请阅读当前 Android 项目，按现有架构接入 Google Play 非消耗型一次性内购。

商品 ID：pro_lifetime（示例，请替换）。购买后永久去广告、去除导出图片的品牌水印。

查阅最新官方文档，完成当地价格展示、购买校验与确认、取消/失败/等待付款、重启与恢复购买，以及退款撤销后的状态同步。只有校验通过且付款完成才解锁，不能只靠本地标记。

请直接实施，运行相关检查并生成测试 AAB，列出我需要完成的后台配置和真机验收步骤，说明哪些已验证、哪些待验证。
```

</div>

代码写好后，还要在 Google Play 管理后台创建对应商品。这次我用内部测试版本验证购买流程，下面按这个过程介绍。

## 2. 管理后台配置

商品卖多少钱、在哪些地区销售，都要在 [Google Play Console 开发者后台](https://play.google.com/console/) 配置。App 通过商品 ID 查询这些信息。

### 测试包

要先上传带有 Billing 权限的 AAB，后台才会开放创建商品的入口。

进入 Play Console，选择应用。打开 **测试和发布 → 测试 → 内部测试 → 发布版本**，创建新版本，上传测试包 AAB。

如果后台提示安装包缺少 Billing 权限，就检查 AAB 的最终清单中是否有 `com.android.vending.BILLING`。修改本地代码后，记得重新打包、上传，后台才能识别到更新。

### 商品信息

等安装包处理完成后，打开 **借助 Play 变现 → 商品 → 一次性商品 → 创建一次性商品**。

<img src="/images/blog/google-play-one-time-purchase-testing/console-product-form.webp" alt="一次性商品创建页面" width="930" loading="lazy" height="714" />

这里主要填写商品 ID、名称和说明。商品 ID 要与 App 查询时使用的 ID 一致，创建后不能再修改。

名称和说明要让用户知道自己买到了什么，例如“永久 Pro”“一次购买，永久去广告、去水印”。

这次使用的商品 ID 是 `mosaic_pro_lifetime`。它标识的是这个付费商品，与应用包名是两回事。

### 购买选项与价格

商品信息填好后，接着配置购买选项。这里设置购买方式、价格和销售地区。

永久解锁选择“购买”，填写购买选项 ID，再设置地区和价格。这次的购买选项 ID 是 `buy`，美国地区定价为 3.99 美元。

打开商品的 **购买选项和优惠**，选择对应选项，再进入 **供应情况和定价**。这里能查到各地区的价格。下面这条泰国记录显示 THB 150.00，供应状态为“供应”。

<img src="/images/blog/google-play-one-time-purchase-testing/console-region-price.webp" alt="泰国地区的价格和供应状态" width="1040" loading="lazy" height="170" />

最后确认商品和购买选项都已启用，测试账号所在地区可以购买。App 要展示 Google Play 返回的当地价格，不能把“3.99 美元”写死在按钮里。

## 3. 测试与验收

商品配置好后，就可以在手机上试买了。先准备测试账号，再完成一笔购买，检查付费功能是否生效，最后到后台核对订单。

### 测试账号

测试安装和购买时，要用同一个 Google 账号。为了不实际扣费，还要给这个账号开通测试付款方式。

后台有两个对应的设置：**内部测试名单**决定谁能安装测试版，**许可测试名单**决定谁能用测试卡付款。

先配置内部测试名单。打开应用的 **测试和发布 → 测试 → 内部测试 → 测试用户数量**，创建电子邮件列表。把准备测试的 Google 账号加进去，再勾选列表并保存。

然后到“发布版本”中发布内部测试版。回到“测试用户数量”，找到底部的 **在网页中参与测试 → 复制链接**。

在手机上用同一个 Google 账号打开链接，加入测试。页面会提供 Google Play 的安装入口，从这里安装测试版。

<img src="/images/blog/google-play-one-time-purchase-testing/console-internal-test.webp" alt="内部测试名单和参与测试链接" width="1635" loading="lazy" height="962" />

接着配置许可测试名单。回到 Play Console 的“所有应用”，打开开发者账号的 **设置 → 许可测试**。选择包含这个 Google 账号的电子邮件列表，许可响应保留 `RESPOND_NORMALLY`，然后保存。

<img src="/images/blog/google-play-one-time-purchase-testing/console-license-test.webp" alt="许可测试名单和许可响应设置" width="1517" loading="lazy" height="1037" />

只加入内部测试名单，购买时仍可能真的扣钱。是否已经开通测试付款，要看手机上的 Google Play 付款面板。面板里应出现测试卡，并提示这笔订单不会收费。

### 测试购买

打开测试版 App 的购买页面，查看价格是否加载出来，再和后台对应地区的定价比较。这次泰国账号显示的是 THB 150.00。

<img src="/images/blog/google-play-one-time-purchase-testing/localized-price.webp" alt="App 显示的泰铢价格" width="860" loading="lazy" height="1920" />

如果价格一直在加载，可以先看后面的“常见问题”。价格正常后，点击购买。确认 Google Play 付款面板显示 **“测试卡，一律批准”** 和不收费的提示，再完成这笔测试购买。

<img src="/images/blog/google-play-one-time-purchase-testing/test-purchase.webp" alt="Google Play 测试购买面板" width="860" loading="lazy" height="1920" />

### 权益检查

付款完成后，回到 App，检查下面几项：

- **Pro 状态**：页面应显示已购买或已解锁，购买入口同步更新。
- **广告**：打开原本会展示广告的页面，操作一次，检查是否还出现广告或留下空白广告位。
- **水印**：处理一张图片并导出，打开保存的图片，检查品牌水印是否已经移除。
- **重启后的状态**：强制停止 App，再打开，检查 Pro 状态和上述功能是否保留。

<img src="/images/blog/google-play-one-time-purchase-testing/pro-unlocked.webp" alt="购买后的 Pro 状态" width="860" loading="lazy" height="1920" />

不要只看页面上的“已购买”。付费功能是否生效，要实际用一次才能确认。

### 后台订单

回到 Play Console 的“所有应用”页面，打开左侧的 **订单管理**。用这次购买的订单 ID 或测试账号的完整邮箱搜索，找到后打开订单详情。

核对商品 ID、购买选项、币种和金额。这次的金额是 THB 150.00，还要确认订单时间与测试时间对应。如果后台标注的是“世界协调时间”，需要换算后再比较。

<img src="/images/blog/google-play-one-time-purchase-testing/console-order-detail.webp" alt="测试订单的状态、时间和金额" width="1114" loading="lazy" height="1412" />

这笔测试订单在后台显示“已处理”。如果你的订单显示待处理或已退款，可以查看“历史记录”，了解发生了什么。

找不到订单时，先检查订单 ID、购买账号和日期筛选范围，再刷新查询。具体查找方式见 [Google 的订单管理说明](https://support.google.com/googleplay/android-developer/answer/2741495?hl=zh-Hans)。

### 其他测试场景

完成一笔测试购买后，下面几种情况还需要分别验证：

- **取消或付款失败**：不解锁，页面结束等待，用户可以重新发起购买。
- **等待付款**：先显示等待状态，款项完成后才解锁；取消后恢复可购买状态。
- **恢复购买**：用同一购买账号重装或换设备，能够找回已购权益，不要求再次付费。
- **退款并撤销权益**：在后台处理后，让 App 重新同步购买状态，确认付费功能随之更新。

## 4. 常见问题

### 价格一直加载

我这次遇到的主要问题就在这里。商品已经启用，App 里却一直拿不到价格。最初使用的是中国大陆地区的账号，后来换成泰国地区的测试账号，才显示出 THB 150.00，并完成测试购买。

遇到类似情况，可以先检查购买账号的 Play 地区。打开手机上的 **Google Play 商店 → 右上角头像**，确认当前账号。

再进入 **设置 → 常规 → 账号和设备偏好设置 → 国家/地区和个人资料**，查看带勾的当前地区。

<img src="/images/blog/google-play-one-time-purchase-testing/play-country.webp" alt="Google Play 账号的国家与地区设置" width="1690" loading="lazy" height="931" />

然后回到 Play Console 的 **购买选项和优惠 → 对应购买选项 → 供应情况和定价**，确认该地区有供应，并核对价格。

更改 Play 地区有条件限制，例如需要人在当地，并拥有当地可用的支付方式。操作前先看 [Google 的地区设置说明](https://support.google.com/googleplay/answer/7431675?hl=zh-Hans)。

地区只是排查的一项，还需要核对以下内容：

- **实际购买账号**：它是否在这两份测试名单中？多账号手机尤其要留意。Google Play 通常使用下载该应用的账号购买，可以展开付款面板查看。
- **商品配置**：代码中的商品 ID 是否一致，商品和购买选项是否已启用。
- **安装版本**：手机上是否是刚发布的测试版。可以核对版本号；需要重装时，先确认本地数据是否需要备份。

使用 adb 时，可以用下面两条命令查看版本号和安装来源。执行前换成自己的包名。第一条需要本机已安装 `rg`。

```bash
adb shell dumpsys package com.magic.snapmosaic | rg 'versionCode=|versionName='
adb shell pm list packages -i com.magic.snapmosaic
```

这些信息确认后，如果仍然拿不到价格，就检查商品查询的响应码和错误日志，也可以请 AI 协助排查。查询失败后，页面应该结束加载，并提供重试入口。

### 付款成功后没有解锁

先检查 App 有没有收到购买结果，以及订单校验是否通过。购买状态为 `PURCHASED`，并且校验通过后，才能解锁权益，再完成确认购买。`PENDING` 表示仍在等待付款，不能提前解锁。

如果这些都正常，再看付费状态有没有更新到页面和实际功能。可以结合日志逐步查找，完整流程见 [Google Play Billing 集成说明](https://developer.android.com/google/play/billing/integrate)。

### 测试订单自动退款

如果测试订单过几分钟就被退款，检查有没有漏掉确认购买。许可测试订单如果未被确认，会在约 3 分钟后自动退款。可以查看后台的订单历史，核对退款时间。规则见 [Google 的购买测试说明](https://developer.android.com/google/play/billing/test)。

### 调试时的安装方式

这次我通过 Google Play 安装内部测试版，一起验证安装和购买流程。日常改代码时，也可以直接安装调试包，不必每次都上传。

直接安装需要满足许可测试条件，调试包的包名也要与 Play 配置一致。具体条件见 [许可测试账号的调试说明](https://developer.android.com/google/play/billing/test#license-testers)。

## 写在最后

这次的内购代码是 AI 写的，Google Play 后台也可以让它协助操作。以前接一个没用过的 SDK，查文档、找示例、处理报错，都要花不少时间。现在这些具体的实现问题，已经可以和 AI 一起解决。

我现在觉得，做独立开发，见识和想法更重要了。知道有哪些能力可以用，能想到拿来解决什么问题，这些在 AI 盛行的当下更珍贵。AI 让实现变得容易了，但做什么、为什么做，还是要靠自己的观察和判断。

参考资料：

- [Google Play Billing 集成与购买处理](https://developer.android.com/google/play/billing/integrate)
- [Google Play Billing 测试说明](https://developer.android.com/google/play/billing/test)
- [一次性商品配置说明](https://support.google.com/googleplay/android-developer/answer/16430488)
