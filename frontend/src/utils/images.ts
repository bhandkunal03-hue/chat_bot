import type { Attachment } from "../types/chat";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function readImageFiles(files: File[], existing: Attachment[] = []) {
  const attachments = [...existing];
  const errors: string[] = [];
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: use a PNG, JPEG, or WebP image.`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: images must be 5 MB or smaller.`);
      continue;
    }
    if (attachments.length >= 4) {
      errors.push("You can attach up to 4 images to one message.");
      break;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    }).catch((error: Error) => {
      errors.push(error.message);
      return "";
    });
    if (dataUrl) {
      attachments.push({ name: file.name, mime_type: file.type as Attachment["mime_type"], data_url: dataUrl });
    }
  }
  return { attachments, errors };
}
