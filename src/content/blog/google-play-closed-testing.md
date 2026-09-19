---
title: "独立 App 开发系列：Google Play 新个人账号的封闭测试实践"
description: "Google Play 新个人账号的封闭测试要求、测试者招募经历与测试人员配置。"
showSummary: false
pubDate: 2026-09-19
draft: false
readingTime: 6
tags: ["独立开发", "Android", "Google Play", "封闭测试"]
lang: "zh-CN"
---

我给自己的 App 申请上架 Google Play 时，需要先完成封闭测试。测试版本先提供给指定的测试者使用，参与人数和持续时间达标后，才能申请正式版发布权限。这是 Google 对新个人开发者账号的要求。

**适用读者：** 准备使用新个人开发者账号在 Google Play 上架 Android App，需要完成封闭式测试的独立开发者。

**文章收获：** 知道要找多少人、测多久，怎样配置测试人员名单，以及什么时候能申请正式版发布权限。

**一句话总结：** 封闭测试要有人持续参与，人数和时间达标后，再申请正式版发布权限。

## 封闭测试要求：12 名测试者，连续 14 天

截至 2026 年 9 月 19 日，Google 对 **2023 年 11 月 13 日之后创建的个人开发者账号**，要求至少 12 名测试者在申请正式版发布权限前的 14 天内，一直保持加入封闭式测试的状态。达到条件后，才能申请正式版发布权限。[Google 官方测试要求](https://support.google.com/googleplay/android-developer/answer/14151465?hl=zh-Hans)

如果你看到的教程还写着“20 名测试者”，需要留意它的时效。实际操作时，先看官方文档和自己 Play Console 里的要求。

这里要求的是**封闭式测试**，内部测试不能替代。14 天也不能把零散参与的天数拼起来；中途退出再加入的人，需要重新满足连续 14 天的条件。[官方说明](https://support.google.com/googleplay/android-developer/answer/14151465?hl=zh-Hans)

人数和时间达标后还要提交申请、等审核，安排上架日期时要把这段时间算进去。

## 免费互测：Testers Community

Testers Community 可以通过互测换积分。帮别人测试 App，赚到积分后，就能把自己的 App 挂到互测广场，招募测试者。

发布到互测广场前，先在应用资料页填好应用名称、开发者名称和 Google Play 链接。测试说明用于告诉别人怎么参与、要测什么。

<figure style="margin: 1.5rem 0;">
  <a href="/images/blog/google-play-closed-testing/testers-community-instructions.png" target="_blank" rel="noopener" aria-label="截图"><img src="/images/blog/google-play-closed-testing/testers-community-instructions.png" alt="互测平台的应用资料与测试说明，应用图标、名称、开发者姓名和链接已遮盖" width="380" loading="lazy" /></a>
  <figcaption style="font-size: 0.85em; line-height: 1.7; color: var(--color-text-soft); margin-top: 0.6em;">发布到互测广场前填写的应用资料，身份信息已打码。</figcaption>
</figure>

参与说明里的“保留安装 14 天”，不等于满足 Google 的连续参与要求。测试者需要通过测试链接加入，并持续保持加入状态。

资料填好后，就可以用积分把 App 挂到互测广场。

<figure style="margin: 1.5rem 0;">
  <a href="/images/blog/google-play-closed-testing/testers-community-marketplace.png" target="_blank" rel="noopener" aria-label="截图"><img src="/images/blog/google-play-closed-testing/testers-community-marketplace.png" alt="Testers Community 互测广场，展示应用列表、积分奖励和添加自己应用的入口" width="340" loading="lazy" /></a>
  <figcaption style="font-size: 0.85em; line-height: 1.7; color: var(--color-text-soft); margin-top: 0.6em;">Testers Community 的互测广场。</figcaption>
</figure>

我当时测完别人的 App，攒够积分，把自己的 App 挂了上去，结果只有一个人来测。一次展示还只有 24 小时，想继续挂着，就得再去测试别人的 App，攒够积分再挂一次。

免费是免费，但人没凑齐，积分又得重新攒。太麻烦了，我没继续折腾。

## 简单粗暴的做法：某鱼买现成的服务

在某鱼直接搜 **Google Play 封闭测试**。我最后花了一百多元买了服务，省得继续攒积分、反复挂广场。对方提供了一个测试组，需要把它加进 Play Console 的测试人员配置，组里的成员才能参与应用的封闭测试。

服务解决的是找人的问题，测试时间还是按 Google 的要求来。当时 Play Console 会显示还剩多少天，可以在后台查看测试进度。

## 配置测试人员名单

这次配置用的是 **电子邮件收件人列表**，在封闭测试轨道里勾选对应的测试名单。

1. 在 Play Console 选择应用，进入 **测试和发布 → 测试 → 封闭式测试**。
2. 打开对应轨道的 **管理轨道 → 测试人员**。
3. 选择 **电子邮件收件人列表**。没有现成列表时，点击 **创建电子邮件列表**，填入列表名称和测试者邮箱；保存后勾选这份列表。
4. 填写接收反馈的邮箱，保存更改。封闭测试版本发布后，把页面下方的参与测试链接发给卖家。

<figure style="margin: 1.5rem 0;">
  <a href="/images/blog/google-play-closed-testing/play-closed-testing-testers.png" target="_blank" rel="noopener" aria-label="测试人员名单配置截图"><img src="/images/blog/google-play-closed-testing/play-closed-testing-testers.png" alt="Alpha 轨道测试人员配置：电子邮件收件人列表已选中，下方有 Android 和网页参与测试链接；列表名称、人数和反馈邮箱已遮盖" width="760" loading="lazy" /></a>
  <figcaption style="font-size: 0.85em; line-height: 1.7; color: var(--color-text-soft); margin-top: 0.6em;">测试人员名单配置与参与测试链接。</figcaption>
</figure>

名单中的账号有参与资格，还需要通过链接加入应用测试，名单人数不等于实际参与人数。Google 群组是另一种配置方式；上图使用的是邮箱列表。[Google 官方配置说明](https://support.google.com/googleplay/android-developer/answer/9845334?hl=zh-Hans)

后台还保留着这次使用的 Alpha 封闭测试轨道，目前已经暂停。

<figure style="margin: 1.5rem 0;">
  <a href="/images/blog/google-play-closed-testing/play-closed-testing-paused-track.png" target="_blank" rel="noopener" aria-label="截图"><img src="/images/blog/google-play-closed-testing/play-closed-testing-paused-track.png" alt="Play Console 已暂停的 Alpha 封闭测试轨道，应用身份信息及个人操作日期已遮盖" width="760" loading="lazy" /></a>
  <figcaption style="font-size: 0.85em; line-height: 1.7; color: var(--color-text-soft); margin-top: 0.6em;">已暂停的 Alpha 封闭测试轨道。</figcaption>
</figure>

## 申请正式版发布权限

测试达到要求后，在应用的信息中心申请正式版发布权限。[Google 官方申请说明](https://support.google.com/googleplay/android-developer/answer/14151465?hl=zh-Hans)

我买的这项服务，测试时间到期后，卖家会给一份申请填写模板，照着填就行。

这次申请一次就通过了，下面是 Google Play 发来的获批邮件。

<figure style="margin: 1.5rem 0;">
  <a href="/images/blog/google-play-closed-testing/play-production-access-approved.png" target="_blank" rel="noopener" aria-label="获批邮件截图"><img src="/images/blog/google-play-closed-testing/play-production-access-approved.png" alt="Google Play 正式版发布权限获批邮件，应用身份信息已遮盖，个人账号和日期已裁去" width="760" loading="lazy" /></a>
  <figcaption style="font-size: 0.85em; line-height: 1.7; color: var(--color-text-soft); margin-top: 0.6em;">Google Play 正式版发布权限获批邮件。</figcaption>
</figure>

拿到权限后，还要发布正式版，应用才会在商店公开上架。
