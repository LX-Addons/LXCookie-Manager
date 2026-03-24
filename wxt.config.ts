import { defineConfig } from "wxt";

const icons = {
  16: "/icon.png",
  32: "/icon.png",
  48: "/icon.png",
  128: "/icon.png",
};

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "LXCookie Manager",
    description: "高级 Cookie 管理，支持白名单/黑名单功能和选择性 Cookie 清除",
    permissions: ["cookies", "storage", "tabs", "browsingData", "alarms"],
    host_permissions: ["https://*/*", "http://*/*"],
    action: {
      default_icon: icons,
      default_title: "LXCookie Manager",
    },
    icons,
    content_security_policy: {
      extension_pages:
        "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'self';",
    },
  },
  vite: () => ({
    build: {
      minify: true,
      sourcemap: false,
    },
  }),
  zip: {
    artifactTemplate: "{{name}}-{{version}}-{{manifestVersion}}.zip",
  },
});
