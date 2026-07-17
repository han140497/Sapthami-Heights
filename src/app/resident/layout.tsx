// Passthrough. The auth guard lives in (secure)/layout.tsx so that /resident/login
// stays reachable while logged out. Route groups in parentheses do not affect URLs:
// (secure)/page.tsx is still /resident.
export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
