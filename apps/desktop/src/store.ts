/**
 * Which app store this copy of Litma came from, if any. Each store updates the app itself, so in a
 * store copy Litma's own updater (updater.ts) and its update card stay off. The downloads from
 * getlitma.in are none of these and update themselves as before.
 *   - mas: Mac App Store (Electron sets process.mas in its Mac App Store build)
 *   - msstore: Microsoft Store (an MSIX/APPX package; Electron sets process.windowsStore)
 *   - snap: Snap Store (the snap runtime sets SNAP)
 */
export type StoreKind = "mas" | "msstore" | "snap";

export const store: StoreKind | null = process.mas ? "mas" : process.windowsStore ? "msstore" : process.env.SNAP ? "snap" : null;
