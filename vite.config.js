import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getHtmlInputs() {
  const inputs = {
    main: path.resolve(__dirname, "index.html"),
  };

  const pagesDir = path.resolve(__dirname, "src/pages");
  if (fs.existsSync(pagesDir)) {
    const files = fs.readdirSync(pagesDir).filter((file) => file.endsWith(".html"));
    for (const file of files) {
      const name = file.replace(/\.html$/, "");
      inputs[name] = path.resolve(pagesDir, file);
    }
  }

  return inputs;
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: getHtmlInputs(),
    },
  },
});
