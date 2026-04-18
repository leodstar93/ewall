import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { getStorageDiskDirectory, getStoragePublicUrl } from "@/lib/storage/resolve-storage";
import { getSettingsErrorResponse, SettingsValidationError } from "@/lib/services/settings-errors";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function getSafeExtension(file: File) {
  const extension = file.name.trim().match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  if (extension && ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  const guard = await requireAdminSettingsApiAccess("settings:update");
  if (!guard.ok) return guard.res;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new SettingsValidationError("Image file is required.");
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new SettingsValidationError("Image must be JPG, PNG, WEBP, or GIF.");
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new SettingsValidationError("Image must be 5 MB or smaller.");
    }

    const directory = getStorageDiskDirectory("production", "news-updates");
    await mkdir(directory, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.${getSafeExtension(file)}`;
    const fileBuffer = await file.arrayBuffer();
    await writeFile(getStorageDiskDirectory("production", "news-updates", fileName), Buffer.from(fileBuffer));

    return Response.json({
      imageUrl: getStoragePublicUrl("production", "news-updates", fileName),
    });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
