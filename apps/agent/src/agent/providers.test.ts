import assert from "node:assert/strict";
import test from "node:test";
import { getProviders } from "./providers";

const config = {
  NEBIUS_API_KEY: "unit-test-placeholder",
  NEBIUS_BASE_URL: "https://model.example.test/v1",
  NEBIUS_MODEL: "verified-nvidia-model-from-catalogue",
  BOTHY_LLM_PROVIDERS: "nebius,qwen-hf",
};

test("Nebius is opt-in and requires key, endpoint, and an explicit model", () => {
  assert.equal(getProviders({}).some((provider) => provider.id === "nebius"), false);
  for (const missing of ["NEBIUS_API_KEY", "NEBIUS_BASE_URL", "NEBIUS_MODEL"]) {
    assert.equal(getProviders({ ...config, [missing]: "" }).some((provider) => provider.id === "nebius"), false);
  }
  const provider = getProviders(config)[0];
  assert.equal(provider.id, "nebius");
  assert.equal(provider.model, config.NEBIUS_MODEL);
  assert.equal(provider.baseUrl, config.NEBIUS_BASE_URL);
  assert.match(provider.label, /connected/);
  assert.equal(provider.timeoutMs, 25_000);
});

test("provider configuration does not leak across independently supplied environments", () => {
  assert.equal(getProviders(config)[0].id, "nebius");
  assert.equal(getProviders({}).some((provider) => provider.id === "nebius"), false);
});
