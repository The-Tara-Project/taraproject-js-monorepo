// vitest.config.mts
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    resolve: {
        alias: {
        },
    },
    test: {
        environment: "node",
        include: [
            "test/**/*.{test,spec}.ts"
        ],
        exclude: [
            "dist/**",
            "node_modules/**",
        ],
        clearMocks: true,
        coverage: {
            enabled: false,
            provider: "v8",
            reportsDirectory: "coverage",
            reporter: ["text", "html"],
        },
    },
});
