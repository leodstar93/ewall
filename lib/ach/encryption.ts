import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import { AchServiceError } from "@/lib/ach/errors";

export type EncryptedPayload = {
  authTag: string;
  cipherText: string;
  iv: string;
  keyId: string;
  version: number;
};

type KeyConfig = {
  key: Buffer;
  keyId: string;
  version: number;
};

function readCurrentKeyConfig(): KeyConfig {
  const rawKey = process.env.ACH_ENCRYPTION_KEY_CURRENT?.trim() ?? "";
  const keyId = process.env.ACH_ENCRYPTION_KEY_ID?.trim() ?? "";
  const rawVersion = process.env.ACH_ENCRYPTION_VERSION?.trim() ?? "1";
  const version = Number(rawVersion);

  if (!rawKey || !keyId || !Number.isInteger(version) || version <= 0) {
    throw new AchServiceError(
      "ACH encryption is not configured. Set ACH_ENCRYPTION_KEY_CURRENT, ACH_ENCRYPTION_KEY_ID, and ACH_ENCRYPTION_VERSION.",
      500,
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(rawKey, "base64");
  } catch {
    throw new AchServiceError("ACH encryption key is invalid.", 500);
  }

  if (key.length !== 32) {
    throw new AchServiceError("ACH encryption key must decode to 32 bytes.", 500);
  }

  return { key, keyId, version };
}

function serializePayload(payload: EncryptedPayload) {
  return JSON.stringify(payload);
}

function parsePayload(serializedPayload: string): EncryptedPayload {
  try {
    const payload = JSON.parse(serializedPayload) as Partial<EncryptedPayload>;
    if (
      typeof payload.cipherText !== "string" ||
      typeof payload.iv !== "string" ||
      typeof payload.authTag !== "string" ||
      typeof payload.keyId !== "string" ||
      typeof payload.version !== "number"
    ) {
      throw new Error("Invalid payload");
    }

    return payload as EncryptedPayload;
  } catch {
    throw new AchServiceError("Stored ACH payload is invalid.", 500);
  }
}

function buildAad(keyId: string, version: number) {
  return Buffer.from(`${keyId}:${version}`, "utf8");
}

export function encryptAchSecret(plaintext: string) {
  const config = readCurrentKeyConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(buildAad(config.keyId, config.version));

  const cipherText = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return serializePayload({
    authTag: cipher.getAuthTag().toString("base64"),
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    keyId: config.keyId,
    version: config.version,
  });
}

export function decryptAchSecret(serializedPayload: string) {
  const config = readCurrentKeyConfig();
  const payload = parsePayload(serializedPayload);

  if (payload.keyId !== config.keyId || payload.version !== config.version) {
    throw new AchServiceError(
      "Stored ACH payload uses an unavailable encryption key version.",
      500,
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    config.key,
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAAD(buildAad(payload.keyId, payload.version));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function getCurrentAchKeyMetadata() {
  const config = readCurrentKeyConfig();

  return {
    keyId: config.keyId,
    version: config.version,
  };
}

export function computeAchChecksum(routingNumber: string, accountNumber: string) {
  const config = readCurrentKeyConfig();

  return createHmac("sha256", config.key)
    .update(`${routingNumber}:${accountNumber}`, "utf8")
    .digest("base64");
}
