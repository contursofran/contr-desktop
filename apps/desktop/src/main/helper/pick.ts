import type { OpenDialogOptions } from "electron";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

type ShowDialog = (options: OpenDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;

/**
 * Picks one image with the native file picker. With CONTR_E2E=1 and CONTR_E2E_PICK_IMAGE set,
 * no dialog opens: that path is the pick, so e2e never shows a window.
 */
export async function pickImage(env: NodeJS.ProcessEnv, show: ShowDialog): Promise<{ ok: boolean; path: string | null; message?: string }> {
  if (env.CONTR_E2E === "1" && env.CONTR_E2E_PICK_IMAGE !== undefined) return { ok: true, path: env.CONTR_E2E_PICK_IMAGE || null };
  try {
    const result = await show({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });
    return { ok: true, path: result.canceled ? null : (result.filePaths[0] ?? null) };
  } catch (e) {
    return { ok: false, path: null, message: String(e) };
  }
}
