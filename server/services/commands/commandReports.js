export function summarizeRecord(record) {
  return {
    id: record?._id ? String(record._id) : undefined,
    title: record?.title || record?.name || record?.category || record?.summary || '',
  };
}

export async function createBrainUpdateReport(BrainUpdateReportModel, payload) {
  return BrainUpdateReportModel.create({
    runDate: payload.runDate || new Date(),
    status: payload.status,
    summary: payload.summary || '',
    recordsCreated: payload.recordsCreated || [],
    recordsUpdated: payload.recordsUpdated || [],
    skippedItems: payload.skippedItems || [],
    linkedTasks: payload.linkedTasks || [],
    linkedProjects: payload.linkedProjects || [],
    warnings: payload.warnings || [],
    errors: payload.errors || [],
    nextRecommendedActions: payload.nextRecommendedActions || [],
    metadata: payload.metadata || {},
  });
}
