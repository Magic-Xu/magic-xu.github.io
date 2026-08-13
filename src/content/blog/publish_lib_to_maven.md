---
title: "Android 开源库发布到 Maven Central：2026 实战踩坑指南"
description: "从 0 到成功发布 Android 库到 Maven Central 的完整实战总结，重点讲清 GPG、Gradle 配置与常见坑，帮你一次打通发布流程。"
pubDate: 2026-04-16
draft: false
readingTime: 8
tags: ["Android", "Maven Central", "开源", "Gradle"]
lang: "zh-CN"
---

> 标签：Android / Maven Central / 开源  
> 预计阅读：8 分钟

## 🚀 我把 Android 库发到 Maven Central，一路踩坑总结（2026 最新版）

> 这篇不是教程，是一线踩坑实录  
> 目标：让你**少踩 90% 的坑，一次发版成功**

---

## 🧠 先说结论（建议先看）

发布 Maven Central，本质就三件事：
- GPG 签名
- Gradle 发布配置
- Sonatype 上传

真正卡人的地方只有两个：

👉 **GPG + Gradle signing**

其他基本都是填信息。

---

## 🧭 一、现在的发布方式（别走老路）

现在已经不用老的 OSSRH 了，直接用：

👉 https://central.sonatype.com

你要做三件事：

- 注册账号
- 创建 namespace（推荐：`io.github.xxx`）
- 创建 token（用户名 + 密码）

---

## 🔐 二、GPG（第一大坑）

这一部分，几乎 80% 的人会卡。

### 1️⃣ 安装
```bash
brew install gnupg
```

### 2️⃣ 生成 key
```bash
gpg --full-generate-key
```
选择：
- 类型：RSA and RSA
- 长度：4096
- 永不过期
- email：建议用 GitHub 同一个

### 3️⃣ 查 keyId
```bash
gpg --list-secret-keys --keyid-format=long
```
输出：
```
sec   rsa4096/XXXXXXXXXXXXXXX
```
👉 `/` 后面那串就是 keyId

### 4️⃣ 导出私钥
```bash
gpg --export-secret-keys -a YOUR_KEY_ID > private-key.asc
```

### 5️⃣ 上传公钥（关键）
不要用命令，直接走网页：
👉 https://keys.openpgp.org

步骤：
1. 上传 public key
2. 收邮件
3. 点验证

### ⚠️ 我踩过的坑（重点）
❌ 坑 1：Outlook 收不到验证邮件
症状：
- 等半小时没反应
- 或直接没有

原因：
👉 这个站点对 Outlook 不太友好

解决：
👉 要么等
👉 要么换 Gmail（更稳）

---

❌ 坑 2：key 上传了但没验证
页面提示：
```
published with only non-identity information
```
👉 这不是成功状态

必须点验证邮件，否则：
- Maven Central 可能验签失败
- 或行为异常

---

## ⚙️ 三、Gradle 配置（别手写，直接让 AI 做）

这一块，说实话：
👉 不值得手写
直接让 Codex / Cursor 帮你生成。

### ✅ 推荐 Prompt（直接复制）
```
请帮我为一个 Android library 模块配置 Maven Central 发布：

要求：
1. 使用 maven-publish + signing
2. 使用 Central Portal（https://central.sonatype.com/api/v1/publisher）
3. 使用 Kotlin DSL（build.gradle.kts）
4. 自动发布 release 组件
5. 自动生成 sources.jar 和 javadoc.jar
6. signing 使用 useInMemoryPgpKeys
7. 所有敏感信息通过 gradle.properties 注入
8. 在 POM 中预留 TODO：
   - POM_DEVELOPER_NAME
   - POM_DEVELOPER_EMAIL
   - POM_GROUP_ID
   - POM_ARTIFACT_ID
   - POM_VERSION_NAME
```
👉 基本一次生成就能用

---

## 🔑 四、gradle.properties（第二大坑）

路径：
```
~/.gradle/gradle.properties
```
👉 注意：不是项目里的，是你电脑全局的

### 示例配置
```properties
mavenCentralUsername=xxx
mavenCentralPassword=xxx

signingInMemoryKey=（一整行私钥）
signingInMemoryKeyPassword=xxx
```

### ⚠️ 最大坑（我卡最久的地方）
❌ 错误写法（直接粘私钥）
```
-----BEGIN PGP PRIVATE KEY BLOCK-----
xxxx
xxxx
-----END PGP PRIVATE KEY BLOCK-----
```
👉 会报错：
```
Could not read PGP secret key
```

✅ 正确写法（必须转成一行）
```bash
python3 -c 'from pathlib import Path; print(Path("~/Desktop/private-key.asc").expanduser().read_text().replace("\\", "\\\\").replace("\n", "\\n"))' | pbcopy
```

然后粘进去：
```properties
signingInMemoryKey=-----BEGIN... \n xxx \n xxx \n -----END...
```

---

## 🧪 五、本地验证（一定要做）

```bash
./gradlew publishToMavenLocal
```

👉 不报错，说明：
- GPG OK
- signing OK

---

## 🚀 六、正式发布

```bash
./gradlew publishAndReleaseToMavenCentral
```

看到：
```
Deployment is being published to Maven Central
BUILD SUCCESSFUL
```
👉 就成功了

---

## 📦 七、发布后去哪看？

1️⃣ Central Portal
👉 最快能看到

2️⃣ Maven 搜索
👉 https://search.maven.org
有延迟（几分钟～几十分钟）

3️⃣ 直接仓库
```
https://repo1.maven.org/maven2/io/github/xxx/xxx/版本/
```
👉 最直接验证方式

---

## 📦 八、别人怎么用你的库

```gradle
dependencies {
    implementation("io.github.xxx:your-lib:0.0.1")
}
```

👉 不需要额外仓库（默认 mavenCentral）

---

## 💣 九、我这一路踩过的坑总结

### 环境问题
- Homebrew 太旧 → 装不了 gnupg
- Git 路径失效 → IDE 报错

### GPG
- 邮件收不到
- keyId 用错
- 没验证邮箱

### Gradle
- 私钥格式错误（最坑）
- signing 配置不匹配

### 发布
- groupId 不合法
- POM 信息缺失

---

## 🎯 最后一句话总结

👉 Maven Central 发布不是难，是“坑多但固定”
踩完一遍，以后就没感觉了。
