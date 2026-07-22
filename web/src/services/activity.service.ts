import api from "./api";

export const postHeartbeat = async (courseId?: string): Promise<void> => {
  try {
    await api.post("/activity/heartbeat", courseId ? { courseId } : {});
  } catch {
    // Fire-and-forget telemetry — never let a failed heartbeat affect the UI.
  }
};
