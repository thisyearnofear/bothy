import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defenseMode, workspaceFocus } from "../lib/workspace";
import DefenseWorkspace from "../components/DefenseWorkspace";
import type { DefenseSession } from "../lib/api";

const session = (roles: DefenseSession["roles"], authenticated = true): DefenseSession => ({ configured: true, authenticated, subject: "fixture", roles });

test("workspace defaults follow verified roles, with reviewer precedence for combined roles", () => {
  assert.equal(workspaceFocus(session(["analyst"])).filter, "all");
  assert.equal(workspaceFocus(session(["reviewer"])).filter, "review");
  assert.equal(workspaceFocus(session(["action-owner"])).filter, "work");
  assert.equal(workspaceFocus(session(["reviewer", "action-owner"])).filter, "review");
  assert.equal(workspaceFocus(session(["reviewer"], false)).filter, "all");
});

test("workspace, investigation and saved-case modes are explicit and old scenario links still work", () => {
  assert.equal(defenseMode({}), "workspace");
  assert.equal(defenseMode({ mode: "investigate" }), "investigation");
  assert.equal(defenseMode({ scenario: "gallium-chain" }), "investigation");
  assert.equal(defenseMode({ brief: "saved", scenario: "gallium-chain" }), "case");
  assert.equal(defenseMode({ brief: ["a", "b"], mode: ["investigate"] }), "workspace");
});

test("sample workspace distinguishes immediate exploration from private onboarding", () => {
  const html = renderToStaticMarkup(createElement(DefenseWorkspace, { initialSession: session([], false) }));
  assert.match(html, /Explore the gallium sample/);
  assert.match(html, /Scope a private pilot/);
  assert.match(html, /Sample data is synthetic/);
  assert.match(html, /Team workflow/);
  assert.doesNotMatch(html, /Exposure question/);
});

test("owner workspace leads with work rather than a new-investigation CTA", () => {
  const html = renderToStaticMarkup(createElement(DefenseWorkspace, { initialSession: session(["action-owner"]) }));
  assert.match(html, /Your verification work/);
  assert.doesNotMatch(html, /Start a separate investigation/);
  assert.match(html, /My active verification work/);
});
