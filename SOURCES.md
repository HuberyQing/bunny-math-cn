# 来源与资源说明

- 原项目：[BinaryDevil/bunny-math](https://github.com/BinaryDevil/bunny-math)。本地下载版本位于本工程，按用户要求复用现有 UI、资源和组件。
- 兔子、星星：`src/components/Bunny.tsx` 内的原版 SVG。
- 主题、方格、描边和按钮基础：`src/styles.css`；中文样式扩展位于 `src/cn/style.css`。
- 贴纸：原版 `src/lib/storage.ts` 中的 Unicode emoji 集合，各设备的实际字形可能不同。
- 音效：原版 `src/lib/sound.ts` 使用 Web Audio 生成，不调用远程音频。
- 庆祝效果：原版 `src/lib/celebrate.ts` 与 `canvas-confetti` 依赖。
- 英文字母与数字字体：原工程的 `@fontsource/baloo-2`、`@fontsource/mochiy-pop-one`。中文使用系统字体，无远程字体请求。
- 原始 `design/`、`public/og.png` 保留作参考，应用入口已移除指向英文站点的分享地址与图片元数据。
- 依赖许可保留在各 npm 包中；本工程不额外声明拥有原项目及第三方素材的版权。

平十与破十的图示思路参考：[徐汇教师网：小学低年级整数减法教学中对学具使用的点滴思考](https://xhteacher.sh.cn/cms/app/info/doc/index.php/92344)。中文应用的题目、分步图解、出题条件和测试在本地实现，不依赖在线题库。

- 右下角署名中文：Google Fonts 的 [ZCOOL KuaiLe / 站酷快乐体](https://fonts.google.com/specimen/ZCOOL+KuaiLe)，仅打包「杨慕筱」三个字形，运行时从本站加载；SIL Open Font License 见 `public/fonts/OFL-ZCOOL-KuaiLe.txt`。英文使用已有 Baloo 2。
