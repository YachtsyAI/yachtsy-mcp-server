import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM sealing for the `ek` access-token claim.
 *
 * Wire format, shared byte for byte with the authorization server in `web`
 * (`server/oauth/TokenCipher.ts`): `base64url(iv[12]) "." base64url(ciphertext ‖ tag[16])`.
 * The key is 32 bytes, configured base64-encoded in YACHTSY_TOKEN_ENC_KEY.
 * Both repos test against the same `token-cipher.vector.json`.
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) {
      throw new Error(
        "ELEPHANT_TOKEN_ENC_KEY must be 32 bytes, base64-encoded.",
      );
    }
    this.key = key;
  }

  seal(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const body = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return `${iv.toString("base64url")}.${body.toString("base64url")}`;
  }

  open(sealed: string): string {
    const [ivPart, bodyPart, ...rest] = sealed.split(".");
    if (!ivPart || !bodyPart || rest.length > 0) {
      throw new Error("Malformed sealed value.");
    }
    const iv = Buffer.from(ivPart, "base64url");
    const body = Buffer.from(bodyPart, "base64url");
    if (iv.length !== IV_BYTES || body.length <= TAG_BYTES) {
      throw new Error("Malformed sealed value.");
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
    return Buffer.concat([
      decipher.update(body.subarray(0, body.length - TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  }
}
