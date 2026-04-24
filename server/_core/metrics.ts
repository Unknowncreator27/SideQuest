export type AdminNetworkMetricRow = {
  path: string;
  requests: number;
  bytesTransferred: number;
};

export type AdminNetworkMetrics = {
  totalRequests: number;
  totalBytesIn: number;
  totalBytesOut: number;
  totalTrafficBytes: number;
  uniqueVisitors: number;
  topPaths: AdminNetworkMetricRow[];
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  requestErrorRate: number;
  averageRequestSize: number;
  averageResponseSize: number;
};

let totalRequests = 0;
let totalBytesIn = 0;
let totalBytesOut = 0;
const uniqueIps = new Set<string>();
const pathCounts = new Map<string, { requests: number; bytesTransferred: number }>();
const methodCounts = new Map<string, number>();
const statusCounts = new Map<string, number>();

function normalizePath(path: string) {
  return path.replace(/\?.*$/, "").replace(/\/+/g, "/") || "/";
}

export function recordRequest(event: {
  path: string;
  method: string;
  status: number;
  bytesIn: number;
  bytesOut: number;
  visitorIp: string;
}) {
  totalRequests += 1;
  totalBytesIn += event.bytesIn;
  totalBytesOut += event.bytesOut;

  const ip = event.visitorIp || "unknown";
  uniqueIps.add(ip);

  const pathKey = normalizePath(event.path);
  const existing = pathCounts.get(pathKey) ?? { requests: 0, bytesTransferred: 0 };
  existing.requests += 1;
  existing.bytesTransferred += event.bytesIn + event.bytesOut;
  pathCounts.set(pathKey, existing);

  const methodKey = event.method.toUpperCase();
  methodCounts.set(methodKey, (methodCounts.get(methodKey) ?? 0) + 1);

  const statusKey = String(event.status);
  statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);
}

export function getNetworkMetrics(): AdminNetworkMetrics {
  const topPaths = Array.from(pathCounts.entries())
    .map(([path, summary]) => ({ path, requests: summary.requests, bytesTransferred: summary.bytesTransferred }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 6);

  const totalRequestsValue = totalRequests || 1;
  const requestsByStatus = Object.fromEntries(statusCounts.entries());
  const errorCount = Array.from(statusCounts.entries()).reduce((sum, [status, count]) => {
    const code = Number(status);
    return sum + (code >= 400 ? count : 0);
  }, 0);

  return {
    totalRequests,
    totalBytesIn,
    totalBytesOut,
    totalTrafficBytes: totalBytesIn + totalBytesOut,
    uniqueVisitors: uniqueIps.size,
    topPaths,
    requestsByMethod: Object.fromEntries(methodCounts.entries()),
    requestsByStatus,
    requestErrorRate: Number(((errorCount / totalRequestsValue) * 100).toFixed(2)),
    averageRequestSize: Math.round(totalBytesIn / totalRequestsValue),
    averageResponseSize: Math.round(totalBytesOut / totalRequestsValue),
  };
}
