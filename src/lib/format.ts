// Shared money formatting — every screen renders prices through this so the
// ₹ prefix and Indian lakh/crore grouping stay consistent app-wide.

export function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}
