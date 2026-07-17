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
    // The packaged app ships no node_modules: everything must bundle. The
    // main bundle lists its inlined deps explicitly (pdfjs-dist would
    // otherwise stay a runtime dynamic import and break in production).
    ...(name === "preload-main-view"
      ? { ssr: { noExternal: true } }
      : name === "main"
        ? { ssr: { noExternal: ["pdfjs-dist"] } }
        : {}),
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
