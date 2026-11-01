import { contextBridge } from "electron";

const version = process.argv.find((a) => a.startsWith("--litma-version="))?.split("=")[1] ?? "";

/** Lets the web app know it runs inside the desktop app (it hides the download links, for example). */
contextBridge.exposeInMainWorld("litmaDesktop", { platform: process.platform, version });
