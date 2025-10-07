/**
 * Activity Logs Routes - Discovery Admin Only
 *
 * Endpoints per monitoraggio real-time e audit delle attività partner
 */

import { Router, Response, NextFunction } from 'express';
import { ActivityLogCategory } from '@prisma/client';
import { activityLogger } from '../../services/activityLogger.service';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

// Middleware per verificare che l'utente sia admin Discovery
const requireAdminRole = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Accesso riservato agli amministratori Discovery',
    });
  }
  next();
};

// Tutti gli endpoint richiedono auth admin Discovery
router.use(authenticate, requireAdminRole);

/**
 * GET /api/admin/activity-logs
 * Lista paginata di activity logs con filtri
 */
router.get('/', async (req, res) => {
  try {
    const {
      partnerEmployeeId,
      partnerCompanyId,
      category,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const filters: any = {
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    };

    if (partnerEmployeeId) filters.partnerEmployeeId = partnerEmployeeId as string;
    if (partnerCompanyId) filters.partnerCompanyId = partnerCompanyId as string;
    if (category) filters.category = category as ActivityLogCategory;
    if (action) filters.action = action as string;
    if (resourceType) filters.resourceType = resourceType as string;
    if (resourceId) filters.resourceId = resourceId as string;

    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await activityLogger.getLogs(filters);

    res.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
          pages: Math.ceil(result.total / filters.limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[ActivityLogs] Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei log',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/activity-logs/stats
 * Statistiche aggregate sui log
 */
router.get('/stats', async (req, res) => {
  try {
    const { partnerCompanyId } = req.query;

    const stats = await activityLogger.getStats(
      partnerCompanyId ? (partnerCompanyId as string) : undefined
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[ActivityLogs] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle statistiche',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/activity-logs/export
 * Export completo per compliance (CSV/JSON)
 */
router.get('/export', async (req, res) => {
  try {
    const { partnerCompanyId, startDate, endDate, format } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate sono obbligatori per export',
      });
    }

    const logs = await activityLogger.exportLogs({
      partnerCompanyId: partnerCompanyId as string | undefined,
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    });

    const exportFormat = (format as string) || 'json';

    if (exportFormat === 'csv') {
      // Export CSV
      const csvHeader = [
        'Timestamp',
        'Partner Company',
        'Employee',
        'Action',
        'Category',
        'Method',
        'Endpoint',
        'Resource Type',
        'Resource ID',
        'IP Address',
        'Success',
        'Error Code',
        'Duration (ms)',
      ].join(',');

      const csvRows = logs.map(log =>
        [
          log.createdAt.toISOString(),
          log.partnerCompany.name,
          `${log.partnerEmployee.firstName} ${log.partnerEmployee.lastName}`,
          log.action,
          log.category,
          log.method || '',
          log.endpoint || '',
          log.resourceType || '',
          log.resourceId || '',
          log.ipAddress || '',
          log.isSuccess ? 'YES' : 'NO',
          log.errorCode || '',
          log.duration || '',
        ]
          .map(field => `"${field}"`)
          .join(',')
      );

      const csv = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="activity-logs-${startDate}-${endDate}.csv"`
      );
      res.send(csv);
    } else {
      // Export JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="activity-logs-${startDate}-${endDate}.json"`
      );
      res.json({
        exportedAt: new Date().toISOString(),
        filters: { partnerCompanyId, startDate, endDate },
        totalLogs: logs.length,
        logs,
      });
    }
  } catch (error: any) {
    console.error('[ActivityLogs] Error exporting logs:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'export dei log',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/activity-logs/company/:companyId
 * Log specifici per azienda partner
 */
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit, offset, category } = req.query;

    const filters: any = {
      partnerCompanyId: companyId,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    };

    if (category) filters.category = category as ActivityLogCategory;

    const result = await activityLogger.getLogs(filters);

    res.json({
      success: true,
      data: {
        companyId,
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
          pages: Math.ceil(result.total / filters.limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[ActivityLogs] Error fetching company logs:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei log azienda',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/activity-logs/employee/:employeeId
 * Log specifici per dipendente partner
 */
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { limit, offset, category } = req.query;

    const filters: any = {
      partnerEmployeeId: employeeId,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    };

    if (category) filters.category = category as ActivityLogCategory;

    const result = await activityLogger.getLogs(filters);

    res.json({
      success: true,
      data: {
        employeeId,
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
          pages: Math.ceil(result.total / filters.limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[ActivityLogs] Error fetching employee logs:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei log dipendente',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/activity-logs/cleanup
 * Cleanup manuale log oltre retention (solo admin)
 */
router.post('/cleanup', async (req, res) => {
  try {
    const deletedCount = await activityLogger.cleanupOldLogs();

    res.json({
      success: true,
      message: `Eliminati ${deletedCount} log oltre retention`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('[ActivityLogs] Error cleaning up logs:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel cleanup dei log',
      details: error.message,
    });
  }
});

export default router;
