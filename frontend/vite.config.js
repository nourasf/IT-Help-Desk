import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Temporary migration aliases for the two large legacy page imports.
      // The actual styles now live in feature folders under src/styles.
      {
        find: "../../styles/Tickets.css",
        replacement: fileURLToPath(new URL("./src/styles/tickets/Tickets.css", import.meta.url)),
      },
      {
        find: "../styles/Reports.css",
        replacement: fileURLToPath(new URL("./src/styles/reports/Reports.css", import.meta.url)),
      },
    ],
  },
});
