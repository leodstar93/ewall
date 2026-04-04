import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { IftaAutomationError } from "@/services/ifta-automation/shared";

type SerializedSecretPayload = {
  keyId: string;
  version: number;
  iv: string;
  authTag: string;
  cipherText: string;
};

type EldOauthStatePayload = {
  provider: string;
  tenantId: string;
  userId: string;
  returnTo: string;
  issuedAt: string;
  nonce: string;
};

function getBase64KeyFromEnv(version: number) {
  const currentVersion = Number(process.env.ELD_ENCRYPTION_VERSION ?? "1");
  const explicit =
    version === currentVersion
      ? process.env.ELD_ENCRYPTION_KEY_CURRENT?.trim()
      : process.env[`ELD_ENCRYPTION_KEY_V${String(version)}`]?.trim();

  if (explicit) {
    const decoded = Buffer.from(explicit, "base64");
    if (decoded.byteLength !== 32) {
      throw new IftaAutomationError(
        "ELD encryption keys must decode to 32 bytes.",
        500,
        "INVALID_ELD_ENCRYPTION_KEY",
      );
    }

    return decoded;
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (!authSecret) {
    throw new IftaAutomationError(
      "ELD encryption is not configured. Set ELD_ENCRYPTION_KEY_CURRENT or AUTH_SECRET.",
      500,
      "ELD_ENCRYPTION_NOT_CONFIGURED",
    );
  }

  // TODO: Use dedicated ELD_ENCRYPTION_KEY_* values in production instead of the AUTH_SECRET fallback.
  return createHash("sha256").update(authSecret, "utf8").digest();
}

function getCurrentEldKeyMetadata() {
  const version = Number(process.env.ELD_ENCRYPTION_VERSION ?? "1");
  const keyId = process.env.ELD_ENCRYPTION_KEY_ID?.trim() || "auth-secret-derived";

  if (!Number.isInteger(version) || version <= 0) {
    throw new IftaAutomationError(
      "ELD_ENCRYPTION_VERSION must be a positive integer.",
      500,
      "INVALID_ELD_ENCRYPTION_VERSION",
    );
  }

  return {
    keyId,
    version,
    key: getBase64KeyFromEnv(version),
  };
}

function getHistoricalEldKey(version: number) {
  return getBase64KeyFromEnv(version);
}

function buildAdditionalAuthData(keyId: string, version: number) {
  return Buffer.from(`eld:${keyId}:${String(version)}`, "utf8");
}

function serializePayload(payload: SerializedSecretPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function parseSerializedPayload(serialized: string): SerializedSecretPayload {
  try {
    const parsed = JSON.parse(Buffer.from(serialized, "base64").toString("utf8")) as Partial<SerializedSecretPayload>;
    if (
      typeof parsed.keyId !== "string" ||
      typeof parsed.version !== "number" ||
      typeof parsed.iv !== "string" ||
      typeof parsed.authTag !== "string" ||
      typeof parsed.cipherText !== "string"
    ) {
      throw new Error("Invalid payload");
    }

    return parsed as SerializedSecretPayload;
  } catch {
    throw new IftaAutomationError("Stored ELD secret could not be decrypted.", 500, "INVALID_ELD_SECRET");
  }
}

export function encryptEldSecret(plaintext: string) {
  const config = getCurrentEldKeyMetadata();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(buildAdditionalAuthData(config.keyId, config.version));

  const cipherText = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return serializePayload({
    keyId: config.keyId,
    version: config.version,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    cipherText: cipherText.toString("base64"),
  });
}

export function decryptEldSecret(serialized: string) {
  const payload = parseSerializedPayload(serialized);
  const key = getHistoricalEldKey(payload.version);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAAD(buildAdditionalAuthData(payload.keyId, payload.version));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

function getOauthStateSecret() {
  const secret =
    process.env.ELD_OAUTH_STATE_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new IftaAutomationError(
      "OAuth state secret is not configured. Set ELD_OAUTH_STATE_SECRET or AUTH_SECRET.",
      500,
      "ELD_OAUTH_STATE_NOT_CONFIGURED",
    );
  }

  return secret;
}

function signStatePayload(serialized: string) {
  return createHmac("sha256", getOauthStateSecret()).update(serialized).digest("base64url");
}

export function buildEldOauthState(input: {
  provider: string;
  tenantId: string;
  userId: string;
  returnTo: string;
}) {
  const payload: EldOauthStatePayload = {
    provider: input.provider,
    tenantId: input.tenantId,
    userId: input.userId,
    returnTo: input.returnTo,
    issuedAt: new Date().toISOString(),
    nonce: randomBytes(12).toString("base64url"),
  };

  const serialized = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${serialized}.${signStatePayload(serialized)}`;
}

export function verifyEldOauthState(state: string) {
  const [serialized, providedSignature] = state.split(".");
  if (!serialized || !providedSignature) {
    throw new IftaAutomationError("OAuth state is invalid.", 400, "INVALID_OAUTH_STATE");
  }

  const expectedSignature = signStatePayload(serialized);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (
    expectedBuffer.byteLength !== providedBuffer.byteLength ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new IftaAutomationError("OAuth state signature is invalid.", 400, "INVALID_OAUTH_STATE");
  }

  try {
    const payload = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as EldOauthStatePayload;
    const issuedAt = new Date(payload.issuedAt);
    if (Number.isNaN(issuedAt.getTime())) {
      throw new Error("Invalid issuedAt");
    }

    const ageMs = Date.now() - issuedAt.getTime();
    if (ageMs > 1000 * 60 * 15) {
      throw new IftaAutomationError("OAuth state has expired.", 400, "EXPIRED_OAUTH_STATE");
    }

    return payload;
  } catch (error) {
    if (error instanceof IftaAutomationError) {
      throw error;
    }

    throw new IftaAutomationError("OAuth state payload is invalid.", 400, "INVALID_OAUTH_STATE");
  }
}
