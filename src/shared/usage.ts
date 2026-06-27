import type { UsageSnapshot, UsageSnapshotStatus, UsageWindowSnapshot } from './models';

function createUsageWindow(label: string): UsageWindowSnapshot {
  return {
    label,
    percent: null,
    resetText: null,
    rawLine: null,
  };
}

export function createEmptyUsageSnapshot(
  status: UsageSnapshotStatus = 'unknown',
  updatedAt: string | null = null,
): UsageSnapshot {
  return {
    status,
    updatedAt,
    nextRefreshAt: null,
    fiveHour: createUsageWindow('5-hour window'),
    weekly: createUsageWindow('Weekly'),
    monthly: createUsageWindow('Monthly limit'),
    rawOutput: '',
    error: null,
  };
}
