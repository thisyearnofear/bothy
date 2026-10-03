import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DefenseOnboarding from "../components/DefenseOnboarding";

test("guided onboarding explains the synthetic hypothesis and starts with analyst evidence", () => {
  const html = renderToStaticMarkup(createElement(DefenseOnboarding));
  assert.match(html, /exercise hypothesis, not a live alert/);
  assert.match(html, /Step 1 of 4/);
  assert.match(html, /Explain the dependency/);
  assert.match(html, /mode=investigate&amp;scenario=gallium-chain/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test("onboarding provides stress checks without certifying completion or collecting sensitive data", () => {
  const html = renderToStaticMarkup(createElement(DefenseOnboarding));
  assert.match(html, /Stress-test checklist/);
  assert.match(html, /checks to perform, not claimed results/);
  assert.match(html, /does not track case state or certify completion/);
  assert.match(html, /Do not enter real programme details/);
  assert.doesNotMatch(html, /<input|<textarea|<form/);
});
