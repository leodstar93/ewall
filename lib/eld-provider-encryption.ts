import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

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

function getEnvValue(primaryKey: string, fallbackKey: string) {
  return process.env[primaryKey]?.trim() ?? process.env[fallbackKey]?.trim() ?? "";
}

function readCurrentKeyConfig(): KeyConfig {
  const rawKey = getEnvValue("ELD_ENCRYPTION_KEY_CURRENT", "ACH_ENCRYPTION_KEY_CURRENT");
  const keyId = getEnvValue("ELD_ENCRYPTION_KEY_ID", "ACH_ENCRYPTION_KEY_ID");
  const rawVersion =
    process.env.ELD_ENCRYPTION_VERSION?.trim() ??
    process.env.ACH_ENCRYPTION_VERSION?.trim() ??
    "1";
  const version = Number(rawVersion);

  if (!rawKey || !keyId || !Number.isInteger(version) || version <= 0) {
    throw new Error(
      "ELD credential encryption is not configured. Set ELD_ENCRYPTION_* or ACH_ENCRYPTION_* environment variables.",
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(rawKey, "base64");
  } catch {
    throw new Error("ELD encryption key is invalid.");
  }

  if (key.length !== 32) {
    throw new Error("ELD encryption key must decode to 32 bytes.");
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
    throw new Error("Stored ELD credential payload is invalid.");
  }
}

function buildAad(keyId: string, version: number) {
  return Buffer.from(`eld:${keyId}:${version}`, "utf8");
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

  return serializePayload({
    authTag: cipher.getAuthTag().toString("base64"),
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    keyId: config.keyId,
    version: config.version,
  });
}

export function decryptEldSecret(serializedPayload: string) {
  const config = readCurrentKeyConfig();
  const payload = parsePayload(serializedPayload);

  if (payload.keyId !== config.keyId || payload.version !== config.version) {
    throw new Error("Stored ELD credential uses an unavailable encryption key version.");
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

export function getCurrentEldKeyMetadata() {
  const config = readCurrentKeyConfig();

  return {
    keyId: config.keyId,
    version: config.version,
  };
}
