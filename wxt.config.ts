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
  vite: (env) => ({
    logLevel: "debug",
    build: {
      minify: false,
    },
  }),
  manifest: {
    name: "Cookie Manager Pro",
    description: "高级Cookie管理，支持白名单/黑名单功能和选择性Cookie清除",
    permissions: ["cookies", "storage", "tabs", "browsingData", "alarms"],
    host_permissions: ["https://*/*", "http://*/*"],
    action: {
      default_icon: icons,
    },
    icons,
    content_security_policy: {
      extension_pages:
        "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'self';",
    },
  },
});
