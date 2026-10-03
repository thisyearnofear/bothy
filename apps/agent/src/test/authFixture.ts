import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createAuth } from "../auth";

export async function authFixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const env = {
    BOTHY_OIDC_ISSUER: "https://issuer.example",
    BOTHY_OIDC_AUDIENCE: "bothy-test-api",
    BOTHY_OIDC_JWKS_URL: "https://issuer.example/keys",
    BOTHY_OIDC_PRINCIPALS: JSON.stringify({
      analyst: ["analyst"], reviewer: ["reviewer"],
      owner: ["action-owner"], other: ["action-owner"],
    }),
  };
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-only" }] });
  const token = (subject: string, audience = env.BOTHY_OIDC_AUDIENCE, expires = "5m", issuer = env.BOTHY_OIDC_ISSUER) =>
    new SignJWT({ roles: ["reviewer"] }).setSubject(subject).setIssuer(issuer).setAudience(audience)
      .setIssuedAt().setExpirationTime(expires).setProtectedHeader({ alg: "RS256", kid: "test-only" }).sign(privateKey);
  return { auth: createAuth(env, keys), token, env, keys };
}
