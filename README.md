# CCP - Claude Code 项目切换器

快速切换 Claude Code 项目和会话的命令行工具。

## 安装

```bash
git clone https://github.com/your-repo/cc-pro.git
cd cc-pro
npm install
npm run build
npm link
```

## 使用

```bash
ccp
```

## 交互流程

**第一步：选择项目**

```
? 选择项目 (↑↓ 切换, 回车确认)
❯ cc-pro          ~/Documents/code/liuding/cc-pro           1会话  刚刚
  session_clean   ~/Documents/code/mindflow/ai/session_clean 3会话  2小时前
  flink-cdc       ~/Documents/code/liuding/flink-cdc         2会话  3天前
```

**第二步：选择会话**

```
? 选择会话 (cc-pro)
❯ ✨ 创建新会话
  ad105672  你知道cc-tool么？...    2.1MB  刚刚
  f3b2c891  帮我修复路径解码...      850KB  1天前
```

- 选择「创建新会话」→ 在项目目录启动新的 claude
- 选择已有会话 → 恢复该会话（`claude -r <sessionId>`）

## 显示信息

**项目列表：**
- 项目名称（路径最后一段）
- 完整路径
- 会话数量
- 最后活跃时间

**会话列表：**
- Session ID（前 8 位）
- 首条用户消息摘要（前 30 字）
- 文件大小
- 最后活跃时间

## 技术说明

- 从 `~/.claude/projects/` 自动发现项目
- 贪心路径解码算法，通过 `fs.existsSync` 逐段验证，支持含 `-` 和 `_` 的目录名
- 按最后活跃时间倒序排列

## 依赖

- commander - CLI 参数解析
- inquirer - 交互式列表选择
- chalk - 终端颜色

## License

MIT
