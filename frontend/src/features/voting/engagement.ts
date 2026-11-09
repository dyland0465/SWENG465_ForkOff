// randomUUID requires a secure context; telemetry should never block navigation.
export function engagementId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
