/**
 * Partner Activity Logger Service
 *
 * Sistema di audit logging con:
 * - Batching automatico (flush ogni 5 sec o 100 eventi)
 * - Buffer in-memory per performance
 * - WebSocket streaming per real-time dashboard
 * - Immutabilità dei log (solo INSERT)
 */

import { PrismaClient, ActivityLogCategory } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

interface ActivityLogEntry {
  partnerEmployeeId: string;
  partnerCompanyId: string;
  action: string;
  category: ActivityLogCategory;
  method?: string;
  endpoint?: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  isSuccess?: boolean;
  errorCode?: string;
  duration?: number;
}

class ActivityLoggerService extends EventEmitter {
  private buffer: ActivityLogEntry[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    super();
    this.startFlushTimer();
    this.setupGracefulShutdown();
  }

  /**
   * Log attività partner
   */
  async log(entry: ActivityLogEntry): Promise<void> {
    if (this.isShuttingDown) {
      // Durante shutdown, flush immediato
      await this.insertLog(entry);
      return;
    }

    this.buffer.push(entry);

    // Emit per WebSocket real-time
    this.emit('log', entry);

    // Auto-flush se buffer pieno
    if (this.buffer.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * Flush batch su database
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      await prisma.partnerActivityLog.createMany({
        data: batch.map(entry => ({
          ...entry,
          createdAt: new Date(),
        })),
        skipDuplicates: true,
      });

      console.log(`[ActivityLogger] Flushed ${batch.length} logs to database`);
    } catch (error) {
      console.error('[ActivityLogger] Failed to flush logs:', error);
      // Re-accoda nel buffer in caso di errore
      this.buffer.unshift(...batch);
    }
  }

  /**
   * Insert singolo (per flush immediato)
   */
  private async insertLog(entry: ActivityLogEntry): Promise<void> {
    try {
      await prisma.partnerActivityLog.create({
        data: entry,
      });
    } catch (error) {
      console.error('[ActivityLogger] Failed to insert log:', error);
    }
  }

  /**
   * Timer auto-flush
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('[ActivityLogger] Auto-flush error:', error);
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('[ActivityLogger] Shutting down gracefully...');
      this.isShuttingDown = true;

      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      await this.flush();
      console.log('[ActivityLogger] Shutdown complete');
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Helper methods per categorie comuni
   */

  async logCritical(
    partnerEmployeeId: string,
    partnerCompanyId: string,
    action: string,
    details: Partial<ActivityLogEntry>
  ): Promise<void> {
    await this.log({
      partnerEmployeeId,
      partnerCompanyId,
      action,
      category: ActivityLogCategory.CRITICAL,
      ...details,
    });
  }

  async logWarning(
    partnerEmployeeId: string,
    partnerCompanyId: string,
    action: string,
    details: Partial<ActivityLogEntry>
  ): Promise<void> {
    await this.log({
      partnerEmployeeId,
      partnerCompanyId,
      action,
      category: ActivityLogCategory.WARNING,
      ...details,
    });
  }

  async logInfo(
    partnerEmployeeId: string,
    partnerCompanyId: string,
    action: string,
    details: Partial<ActivityLogEntry>
  ): Promise<void> {
    await this.log({
      partnerEmployeeId,
      partnerCompanyId,
      action,
      category: ActivityLogCategory.INFO,
      ...details,
    });
  }

  /**
   * Query logs con paginazione
   */
  async getLogs(filters: {
    partnerEmployeeId?: string;
    partnerCompanyId?: string;
    category?: ActivityLogCategory;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters.partnerEmployeeId) where.partnerEmployeeId = filters.partnerEmployeeId;
    if (filters.partnerCompanyId) where.partnerCompanyId = filters.partnerCompanyId;
    if (filters.category) where.category = filters.category;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [total, logs] = await Promise.all([
      prisma.partnerActivityLog.count({ where }),
      prisma.partnerActivityLog.findMany({
        where,
        include: {
          partnerEmployee: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          partnerCompany: {
            select: {
              name: true,
              referralCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      }),
    ]);

    return { total, logs };
  }

  /**
   * Export logs per compliance
   */
  async exportLogs(filters: {
    partnerCompanyId?: string;
    startDate: Date;
    endDate: Date;
  }) {
    const where: any = {
      createdAt: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    };

    if (filters.partnerCompanyId) {
      where.partnerCompanyId = filters.partnerCompanyId;
    }

    const logs = await prisma.partnerActivityLog.findMany({
      where,
      include: {
        partnerEmployee: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        partnerCompany: {
          select: {
            name: true,
            referralCode: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return logs;
  }

  /**
   * Cleanup logs oltre retention (365 giorni)
   */
  async cleanupOldLogs(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 365);

    const result = await prisma.partnerActivityLog.deleteMany({
      where: {
        createdAt: {
          lt: retentionDate,
        },
      },
    });

    console.log(`[ActivityLogger] Deleted ${result.count} old logs (before ${retentionDate.toISOString()})`);
    return result.count;
  }

  /**
   * Statistiche logs
   */
  async getStats(partnerCompanyId?: string) {
    const where = partnerCompanyId ? { partnerCompanyId } : {};

    const [total, byCategory, byAction] = await Promise.all([
      prisma.partnerActivityLog.count({ where }),
      prisma.partnerActivityLog.groupBy({
        by: ['category'],
        where,
        _count: true,
      }),
      prisma.partnerActivityLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      byCategory,
      topActions: byAction,
    };
  }
}

// Singleton instance
export const activityLogger = new ActivityLoggerService();
