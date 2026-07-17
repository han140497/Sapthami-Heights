// Passthrough. The auth guard lives in (secure)/layout.tsx so /committee/login
// stays reachable while logged out.
export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
