import { defineConfig } from "vitepress";
import { defineTeekConfig } from "vitepress-theme-teek/config";

const teekConfig = defineTeekConfig({
  themeEnhance: {
    layoutSwitch: {
      defaultMode: "doc",
    },
  },
});

export default defineConfig({
  extends: teekConfig,
  title: "个人知识库 | changelog",
  description: "人可读、agent 可检索的个人可复用知识库",
  lang: "zh-CN",
  cleanUrls: true,
  themeConfig: {
    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "搜索文档",
            buttonAriaLabel: "搜索文档",
          },
          modal: {
            noResultsText: "未找到相关结果",
            resetButtonTitle: "清除查询条件",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
    nav: [
      { text: "首页", link: "/" },
      { text: "实战手册", link: "/playbooks/" },
      { text: "提示词库", link: "/prompts/" },
      {
        text: "复盘认知",
        items: [
          { text: "认知概览", link: "/learnings/" },
          { text: "踩坑记录 (Errors)", link: "/learnings/ERRORS" },
          { text: "单点认知 (Learnings)", link: "/learnings/LEARNINGS" },
          { text: "功能诉求 (Feature Requests)", link: "/learnings/FEATURE_REQUESTS" },
        ],
      },
      { text: "规范与契约", link: "/WORKFLOW" },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/qqlcx5/changelog" },
    ],
    outline: {
      level: [2, 4],
      label: "本页大纲",
    },
    docFooter: {
      prev: "上一篇",
      next: "下一篇",
    },
    darkModeSwitchLabel: "外观切换",
    returnToTopLabel: "返回顶部",
    sidebarMenuLabel: "菜单",
  },
});
