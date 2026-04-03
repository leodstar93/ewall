import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

type EncryptedPayload = {
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

function buildFallbackKey() {
  const authSecret = process.env.AUTH_SECRET?.trim() ?? "";
  if (!authSecret) {
    throw new Error("ELD encryption is not configured and AUTH_SECRET is unavailable.");
  }

  return createHash("sha256").update(authSecret, "utf8").digest();
}

function readCurrentKeyConfig(): KeyConfig {
  const rawKey = process.env.ELD_ENCRYPTION_KEY_CURRENT?.trim() ?? "";
  const keyId = process.env.ELD_ENCRYPTION_KEY_ID?.trim() || "auth-secret-derived";
  const rawVersion = process.env.ELD_ENCRYPTION_VERSION?.trim() ?? "1";
  const version = Number(rawVersion);

  if (!Number.isInteger(version) || version <= 0) {
    throw new Error("ELD_ENCRYPTION_VERSION must be a positive integer.");
  }

  const key = rawKey ? Buffer.from(rawKey, "base64") : buildFallbackKey();

  if (key.length !== 32) {
    throw new Error("ELD encryption key must resolve to 32 bytes.");
  }

  return { key, keyId, version };
}

function parsePayload(serializedPayload: string) {
  const payload = JSON.parse(serializedPayload) as Partial<EncryptedPayload>;

  if (
    typeof payload.authTag !== "string" ||
    typeof payload.cipherText !== "string" ||
    typeof payload.iv !== "string" ||
    typeof payload.keyId !== "string" ||
    typeof payload.version !== "number"
  ) {
    throw new Error("Stored ELD payload is invalid.");
  }

  return payload as EncryptedPayload;
}

function buildAad(keyId: string, version: number) {
  return Buffer.from(`${keyId}:${version}`, "utf8");
}

export function encryptEldSecret(plaintext: string) {
  const config = readCurrentKeyConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);

  cipher.setAAD(buildAad(config.keyId, config.version));

  const cipherText = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return JSON.stringify({
    authTag: cipher.getAuthTag().toString("base64"),
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    keyId: config.keyId,
    version: config.version,
  } satisfies EncryptedPayload);
}

export function decryptEldSecret(serializedPayload: string) {
  const config = readCurrentKeyConfig();
  const payload = parsePayload(serializedPayload);

  if (payload.keyId !== config.keyId || payload.version !== config.version) {
    throw new Error("Stored ELD payload uses an unavailable encryption key version.");
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
