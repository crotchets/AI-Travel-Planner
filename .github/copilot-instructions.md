- [x] Verify that the copilot-instructions.md file in the .github directory is created. (已创建本文件)

- [x] Clarify Project Requirements (Next.js 15 + TypeScript + Tailwind + Supabase，根据用户PRD确定)
	- Ask for project type, language, and frameworks if not specified. Skip if already provided.

- [ ] Scaffold the Project
	- Ensure that the previous step has been marked as completed.
	- Call project setup tool with projectType parameter.
	- Run scaffolding command to create project files and folders.
	- Use '.' as the working directory.
	- 如果没有合适的 projectType，请先查文档或手动创建结构。

- [ ] Customize the Project
	- 在确认前序步骤完成后再开始。
	- 根据用户需求制定代码修改计划。
	- 使用合适的工具落实改动（跳过纯 Hello World 项目）。

- [ ] Install Required Extensions
	- 仅安装 get_project_setup_info 中提到的扩展。

- [ ] Compile the Project
	- 确认依赖安装齐全后运行编译/诊断并修复问题。
	- 注意查阅仓库中的 markdown 指南。

- [ ] Create and Run Task
	- 如需 VS Code tasks.json，请参考官方文档并使用 create_and_run_task 工具。

- [ ] Launch the Project
	- 启动前与用户确认是否需要调试模式。

- [ ] Ensure Documentation is Complete
	- 确认 README.md 与 copilot-instructions.md 已更新项目信息。
	- 移除所有 HTML 注释，保持文件简洁。
## Execution Guidelines
PROGRESS TRACKING:
- 使用可用的待办工具跟踪以上清单。
- 完成步骤后及时标记并添加简洁总结。
- 在开始新步骤前先查看当前状态。

COMMUNICATION RULES:
- 避免冗长输出或整段命令结果。
- 若跳过步骤，请简要说明原因（如“无需额外扩展”）。
- 非必要不解释项目结构，保持表达精炼。

DEVELOPMENT RULES:
- 默认使用当前目录作为工作根目录。
- 未经请求不要添加媒体或外部链接。
- 使用占位内容时需提示后续替换。
- 仅在开发 VS Code 扩展时使用 VS Code API 工具。
- 项目已在 VS Code 打开，无需再次提示打开步骤。
- 若项目设定另有规则，需优先遵循。

FOLDER CREATION RULES:
- 始终以当前目录为项目根目录操作。
- 运行终端命令时保持使用 '.' 作为路径。
- 除非用户要求，避免创建额外文件夹（.vscode 除外）。
- 若脚手架命令提示目录不正确，应提示用户调整后重新打开。

EXTENSION INSTALLATION RULES:
- 仅安装 get_project_setup_info 指定的扩展。

PROJECT CONTENT RULES:
- 若未说明具体需求，默认提供 Hello World 起步项目。
- 非明确要求不要添加链接或外部集成。
- 未经请求不要生成图片、视频等媒体。
- 使用占位媒体时需标注提醒替换。
- 新增组件需服务于明确的用户流程。
- 需求不明时优先向用户确认。
- 开发 VS Code 扩展时，需结合 VS Code API 文档查询示例。

TASK COMPLETION RULES:
- 当满足以下条件即可视为完成：
  - 项目成功搭建并可编译通过
  - .github 目录下存在 copilot-instructions.md
  - README.md 已更新最新项目信息
  - 向用户提供明确的调试/启动指引

- 开启新任务前请更新上述清单状态。
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
