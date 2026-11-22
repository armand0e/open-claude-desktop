import path from "node:path";
import { builtinModules } from "node:module";
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
    // Bundle JS-only implementation dependencies. Native/runtime-asset
    // dependencies stay external so they are loaded lazily from the packaged
    // node_modules instead of running heavyweight setup during app startup.
    ...(name === "preload-main-view"
      ? { ssr: { noExternal: true } }
      : name === "main"
        ? {
            ssr: {
              noExternal: true,
            },
          }
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
        // playwright-core and PDF.js load from packaged node_modules at
        // runtime. Bundling either breaks dirname-relative assets; inlining
        // PDF.js also executes its browser polyfills before Electron is ready.
        external: [
          "electron",
          "node-pty",
          "pdfjs-dist/legacy/build/pdf.mjs",
          "playwright-core",
          ...builtinModules,
          /^node:/,
        ],
        output: {
          format: "cjs",
          inlineDynamicImports: true,
          entryFileNames: `${name}.cjs`,
        },
      },
    },
  });
}
