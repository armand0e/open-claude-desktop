import { Menu, nativeImage, Tray } from "electron";
import { LOCAL_APP_NAME } from "../shared/app-identity";

export interface LocalTrayOptions {
  iconPath?: string;
  openMainWindow(): void;
  openRoutines(): void;
  quit(): void;
}

/** Owns the operating-system tray/menu-bar item for the local desktop app. */
export class LocalTrayController {
  private tray: Tray | null = null;

  constructor(private readonly options: LocalTrayOptions) {}

  get enabled(): boolean {
    return this.tray !== null && !this.tray.isDestroyed();
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.dispose();
      return;
    }
    if (this.enabled) return;
    if (!this.options.iconPath)
      throw new Error("The system tray icon is unavailable");

    const image = nativeImage.createFromPath(this.options.iconPath);
    if (image.isEmpty())
      throw new Error("The system tray icon could not be loaded");
    if (process.platform === "darwin") image.setTemplateImage(true);

    const tray = new Tray(image);
    try {
      tray.setToolTip(LOCAL_APP_NAME);
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: `Open ${LOCAL_APP_NAME}`,
            click: this.options.openMainWindow,
          },
          { label: "Routines", click: this.options.openRoutines },
          { type: "separator" },
          { label: "Quit", click: this.options.quit },
        ]),
      );
      tray.on("click", this.options.openMainWindow);
      tray.on("double-click", this.options.openMainWindow);
      this.tray = tray;
    } catch (error) {
      tray.destroy();
      throw error;
    }
  }

  dispose(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
