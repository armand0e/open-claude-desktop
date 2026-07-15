import path from "node:path";
import { build } from "vite";

const entries = [
  ["main", "src/main/index.ts"],
  ["preload-main-view", "src/preload/main-view.ts"],
  ["preload-shell", "src/preload/shell.ts"],
];

for (const [index, [name, input]] of entries.entries()) {
  await build({
    configFile: false,
    logLevel: "info",
    build: {
      ssr: true,
      outDir: "dist-electron",
      emptyOutDir: index === 0,
      target: "node22",
      minify: false,
      sourcemap: true,
      rollupOptions: {
        input: path.resolve(input),
        external: ["electron", "node-pty", /^node:/],
        output: {
          format: "cjs",
          inlineDynamicImports: true,
          entryFileNames: `${name}.cjs`,
        },
      },
    },
  });
}
