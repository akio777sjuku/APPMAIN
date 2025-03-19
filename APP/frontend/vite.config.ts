import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        topLevelAwait({
            // The export name of top-level await promise for each chunk module
            promiseExportName: "__tla",
            // The function to generate import names of top-level await promise in each chunk module
            promiseImportName: i => `__tla_${i}`
        })
    ],
    build: {
        outDir: "../backend/static",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: id => {
                    if (id.includes("@fluentui/react-icons")) {
                        return "fluentui-icons";
                    } else if (id.includes("@fluentui/react")) {
                        return "fluentui-react";
                    } else if (id.includes("node_modules")) {
                        return "vendor";
                    }
                }
            }
        }
    },
    server: {
        port: 50555,
        proxy: {
            "/auth_setup": "http://localhost:50505",
            "/ask": "http://localhost:50505",
            "/qaanswer": "http://localhost:50505",
            "/gptanswer": "http://localhost:50505",
            "/retrievechat": "http://localhost:50505",
            "/api/chat": "http://localhost:50505",
            "/api/chatlist": "http://localhost:50505",
            "/api/chatcontent": "http://localhost:50505",
            "/api/translatetext": "http://localhost:50505",
            "/api/proofreadingtext": "http://localhost:50505",
            "/api/enterprisefile": "http://localhost:50505",
            "/api/downloadEnterpriseFile": "http://localhost:50505",
            "/api/userlogininfo": "http://localhost:50505",
            "/api/folder": "http://localhost:50505",
            "/api/authentication": "http://localhost:50505"
        }
    }
});
