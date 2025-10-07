/**
 * Activity Logs Cleanup Job
 *
 * Cron job per retention policy:
 * - Elimina log > 365 giorni
 * - Opzionale: archivio su S3/R2 prima di eliminare
 * - Esegue ogni giorno alle 02:00
 */

import cron from 'node-cron';
import { activityLogger } from '../services/activityLogger.service';
import { activityLoggerWS } from '../services/activityLoggerWebSocket.service';

/**
 * Job principale cleanup
 */
async function runCleanup(): Promise<void> {
  console.log('[ActivityLogsCleanup] Starting scheduled cleanup...');

  try {
    const deletedCount = await activityLogger.cleanupOldLogs();

    console.log(`[ActivityLogsCleanup] Completed. Deleted ${deletedCount} old logs.`);

    // Notifica admin via WebSocket
    activityLoggerWS.broadcastAdminNotification({
      type: 'info',
      title: 'Activity Logs Cleanup',
      message: `Eliminati ${deletedCount} log oltre retention (365 giorni)`,
      data: {
        deletedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[ActivityLogsCleanup] Error during cleanup:', error);

    // Notifica errore ad admin
    activityLoggerWS.broadcastAdminNotification({
      type: 'critical',
      title: 'Activity Logs Cleanup Failed',
      message: 'Errore durante cleanup automatico log',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Schedule cron job
 * Esegue ogni giorno alle 02:00
 */
export function startActivityLogsCleanupJob(): void {
  console.log('[ActivityLogsCleanup] Scheduling cron job: daily at 02:00');

  cron.schedule(
    '0 2 * * *', // Alle 02:00 ogni giorno
    () => {
      runCleanup().catch(error => {
        console.error('[ActivityLogsCleanup] Cron job error:', error);
      });
    },
    {
      timezone: 'Europe/Rome',
    }
  );

  console.log('[ActivityLogsCleanup] Cron job scheduled successfully');
}

/**
 * Esegui cleanup manuale (per testing)
 */
export async function runManualCleanup(): Promise<number> {
  return await activityLogger.cleanupOldLogs();
}

// Opzionale: archivio su S3/R2 prima di delete
// TODO: implementare archivio cold storage per log > 1 anno
// import { uploadToS3 } from '../services/s3.service';
//
// async function archiveOldLogs(): Promise<void> {
//   const retentionDate = new Date();
//   retentionDate.setDate(retentionDate.getDate() - 365);
//
//   const logs = await prisma.partnerActivityLog.findMany({
//     where: { createdAt: { lt: retentionDate } },
//   });
//
//   if (logs.length === 0) return;
//
//   const archiveFile = JSON.stringify(logs, null, 2);
//   const fileName = `activity-logs-archive-${retentionDate.toISOString()}.json`;
//
//   await uploadToS3(fileName, archiveFile);
//
//   console.log(`[ActivityLogsCleanup] Archived ${logs.length} logs to S3: ${fileName}`);
// }
