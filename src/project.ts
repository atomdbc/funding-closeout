/** Capability flags are not an uptime promise or a statement of contest readiness. */
export function projectStatus() {
  return {
    project: "Funding closeout — working label",
    state: "local-prototype",
    productSelected: true,
    nearReadOnlyEnabled: true,
    nearVerification: "on-demand-public-rpc",
    nearNetwork: "mainnet",
    walletConnected: false,
    defaultWorkspace: "fictional-example",
    deadlineUtc: "2026-11-14T23:59:00Z",
  } as const;
}
