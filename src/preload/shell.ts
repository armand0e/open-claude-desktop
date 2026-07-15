import { contextBridge } from "electron";
import {
  exposeContract,
  exposeSanitizedProcess,
  argumentJson,
} from "./expose-contract";

contextBridge.exposeInMainWorld("desktopReconstructionReady", {
  phase: "preload-start",
});
exposeContract("mainWindow.js");
const appVersion =
  process.argv
    .find((value) => value.startsWith("--desktop-app-version="))
    ?.slice(22) ?? "0.1.0";
exposeSanitizedProcess(appVersion);
const enterpriseConfig = argumentJson("--desktop-enterprise-config=");
if (enterpriseConfig !== undefined)
  contextBridge.exposeInMainWorld("desktopEnterpriseConfig", enterpriseConfig);
