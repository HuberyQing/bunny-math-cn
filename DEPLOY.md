# 发布到 GitHub Pages

当前工程已配置 GitHub Pages 自动部署。以下说明可用于重新部署或后续更新，无需在聊天中提供密码或令牌。

## 1. 本地确认

建议使用 Node.js 24 LTS，项目已有 `.nvmrc`。终端进入应用目录：

```sh
cd /Users/hubery/Desktop/readApp/githubPage/bunny-math-main
npm ci
npm test
npm run build
```

预览源码时运行 `npm run dev`，打开终端显示的本地网址。预览生产版本时运行 `npm run preview`。请通过本地服务打开，直接双击 `dist/index.html` 可能受浏览器模块加载限制。

## 2. 新建 GitHub 仓库

1. 登录自己的 GitHub，选择 New repository。
2. 仓库名建议 `bunny-math-cn`，也可以使用其他名称。
3. 使用 GitHub Free 时选择 Public。保持新仓库为空，不勾选初始化 README、`.gitignore` 或 LICENSE，以便导入当前工程。
4. 创建后复制 HTTPS 仓库地址，例如 `https://github.com/你的用户名/bunny-math-cn.git`。

此应用没有后端、数据库或 AI 服务，不需要添加部署密钥、API Key、环境变量或购买域名。家长和孩子访问发布地址也无需 GitHub 账号。

## 3. 上传本地应用

推荐把 `bunny-math-main` 本身作为仓库根目录。先在这个目录运行 `git status`，确认它还没有已有仓库；首次上传按下面命令操作，把示例用户名替换成自己的 GitHub 用户名：

```sh
cd /Users/hubery/Desktop/readApp/githubPage/bunny-math-main
git init -b main
git add .
git commit -m "Add Chinese bunny math practice app"
git remote add origin https://github.com/你的用户名/bunny-math-cn.git
git push -u origin main
```

如果 Git 提示需要配置提交身份，按提示在此仓库配置 `git config user.name "你的名字"` 和 `git config user.email "你的邮箱"` 后重新提交。如果推送需要身份验证，使用 GitHub Desktop、GitHub CLI 的正常登录或 GitHub 支持的凭据方式；GitHub 网页密码不能直接作为 HTTPS Git 密码。

也可以使用 GitHub Desktop 的 Add Local Repository → Publish repository 上传这个目录。`.gitignore` 已排除 `node_modules`、`dist` 和本机系统文件。需要上传源文件与隐藏的 `.github/workflows/deploy.yml`，不要只上传 `dist`，也不要把整个 `readApp` 目录上传。

## 4. 打开 GitHub Pages

1. 进入新仓库的 Settings → Pages。
2. 在 Build and deployment 的 Source 中选择 **GitHub Actions**。
3. 进入仓库 Actions，找到 **Deploy to GitHub Pages**。
4. 如果首次推送发生在开启 Pages 之前，点击 Run workflow，选择 `main`，手动运行一次。
5. 等待 `build` 和 `deploy` 两个任务均成功。工作流会自动安装依赖、运行测试、构建并发布 `dist`。
6. 在 Settings → Pages 或此次工作流的 `github-pages` 部署环境中打开网站地址。

默认地址为 `https://你的用户名.github.io/bunny-math-cn/`。实际地址以 GitHub 返回值为准。Vite 已使用相对资源路径，换仓库名也不需要修改路径配置。

仓库应包含：

```text
bunny-math-cn/
  package.json
  package-lock.json
  index.html
  vite.config.ts
  src/
  public/
  .github/workflows/deploy.yml
```

如果把应用作为其他仓库的子目录发布，需要额外调整工作流的运行目录、npm 缓存路径和 `upload-pages-artifact` 的 `path`；推荐首版直接使用上述独立仓库结构。

## 5. 发布后检查

- 打开首页，确认中文、兔子、图标及键盘正常加载，刷新不会出现 404。
- 在手机上完成一轮，在横屏平板上查看三种方法的图解。
- 刷新进行中的练习，确认可以继续；打开贴纸册和结果页。
- 使用「练习纸」查看打印预览；答案页默认关闭，需要时再勾选。

以后修改代码，只需要提交并推送到 `main`，工作流就会重新检查并更新网站：

```sh
git add .
git commit -m "Update math practice"
git push
```

常见问题：Pages 提示未启用时检查 Source 是否为 GitHub Actions；资源 404 时检查工作流是否上传正确的 `dist`；部署失败时查看 Actions 中标红任务的日志，修复后重新运行。

参考：[GitHub Pages 介绍](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
