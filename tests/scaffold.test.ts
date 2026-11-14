import test from "node:test";
import assert from "node:assert/strict";
import { projectStatus } from "../src/project.ts";

test("prototype capability flags distinguish local features from NEAR and wallet integration", () => {
  const status = projectStatus();
  assert.equal(status.state, "local-prototype");
  assert.equal(status.productSelected, true);
  assert.equal(status.nearReadOnlyEnabled, true);
  assert.equal(status.nearVerification, "on-demand-public-rpc");
  assert.equal(status.walletConnected, false);
  assert.equal(status.defaultWorkspace, "fictional-example");
});
