import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = (env.VITE_API_BASE_URL || "http://localhost:5099").replace(/\/+$/, "");

  return {
    plugins: [
      react(),
      {
        name: "supporthub-api-url-safety-net",
        enforce: "pre",
        transform(code, id) {
          const isFrontendSource = id.includes("/src/") || id.includes("\\src\\");
          if (!isFrontendSource || !code.includes("http://localhost:5099")) return null;
          return {
            code: code.replaceAll("http://localhost:5099", apiBaseUrl),
            map: null,
          };
        },
      },
    ],
    resolve: {
      alias: [
        // Temporary migration aliases for legacy page imports.
        // The actual styles now live in feature folders under src/styles.
        {
          find: "../../styles/Tickets.css",
          replacement: fileURLToPath(new URL("./src/styles/tickets/Tickets.css", import.meta.url)),
        },
        {
          find: "../../styles/TicketWorkflow.css",
          replacement: fileURLToPath(new URL("./src/styles/tickets/TicketOverrides.css", import.meta.url)),
        },
        {
          find: "../styles/Reports.css",
          replacement: fileURLToPath(new URL("./src/styles/reports/Reports.css", import.meta.url)),
        },
      ],
    },
  };
});
