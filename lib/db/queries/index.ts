/**
 * Barrel re-export for all database query modules.
 * Consumers import from "@/lib/db/queries" — this file ensures
 * zero breaking changes after the split from the monolithic queries.ts.
 */

// biome-ignore-all lint/performance/noBarrelFile: intentional barrel for backwards-compatible re-exports
export {
  createStreamId,
  deleteAllChatsByUserId,
  deleteChatById,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getChatsByUserId,
  getMessageById,
  getMessageCountByBillingPeriod,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  getVotesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  updateChatTitle,
  voteMessage,
} from "./chat-queries";
export { db } from "./connection";
export {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentById,
  getDocumentsById,
  getGenerationIdByDocumentId,
  getSuggestionsByDocumentId,
  saveDocument,
  saveSuggestions,
} from "./document-queries";
export {
  createProject,
  createProjectFile,
  deleteProject,
  deleteProjectFileRecord,
  getDefaultProject,
  getProjectById,
  getProjectFileById,
  getProjectFiles,
  getProjectsByUserId,
  incrementProjectUsage,
  updateProject,
} from "./project-queries";
export {
  createUserSubscription,
  getActiveUserSubscription,
  getLatestUserSubscriptionWithPlan,
  getSubscriptionPlanByName,
  getSubscriptionPlans,
  getUserSubscriptionWithPlan,
  saveCancellationFeedback,
} from "./subscription-queries";
export {
  createTextStyle,
  deleteTextStyle,
  getDefaultTextStyle,
  getTextStyleById,
  getTextStylesByUserId,
  incrementTextStyleUsage,
  updateTextStyle,
} from "./text-style-queries";
export {
  getImageGenerationCountByBillingPeriod,
  getImageGenerationCountByDateRange,
  getSearchUsageCountByBillingPeriod,
  getSearchUsageCountByDateRange,
  getVideoGenerationCountByBillingPeriod,
  getVideoGenerationCountByDateRange,
  insertImageGenerationUsageLog,
  insertSearchUsageLog,
  insertVideoGenerationUsageLog,
} from "./usage-queries";
export {
  clearEmailVerificationCode,
  clearPasswordResetToken,
  createUser,
  getUserByResetToken,
  getUserByVerificationCode,
  isEmailVerified,
  markEmailAsVerified,
  setEmailVerificationCode,
  setPasswordResetToken,
  updateUserPassword,
} from "./user-queries";
