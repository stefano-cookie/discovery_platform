/**
 * Activity Logger Middleware
 *
 * Intercetta automaticamente TUTTE le richieste dei partner e logga:
 * - Operazioni CRITICAL: login, documenti, pagamenti, trasferimenti
 * - Operazioni WARNING: errori, tentativi falliti
 * - Operazioni INFO: letture, navigazione (configurabile)
 */

import { Request, Response, NextFunction } from 'express';
import { ActivityLogCategory } from '@prisma/client';
import { activityLogger } from '../services/activityLogger.service';

// Estendi Request type per includere partner info
declare global {
  namespace Express {
    interface Request {
      partnerEmployee?: {
        id: string;
        partnerCompanyId: string;
        email: string;
      };
    }
  }
}

// Configurazione regole logging
const LOGGING_RULES = {
  // CRITICAL: Sempre loggare
  critical: [
    { method: 'POST', path: /^\/api\/auth\/partner\/login/ },
    { method: 'POST', path: /^\/api\/auth\/2fa/ },
    { method: 'POST', path: /^\/api\/partner\/registrations/ },
    { method: 'PUT', path: /^\/api\/partner\/registrations\/[^/]+\/status/ },
    { method: 'POST', path: /^\/api\/partner\/documents/ },
    { method: 'PUT', path: /^\/api\/partner\/documents/ },
    { method: 'DELETE', path: /^\/api\/partner\/documents/ },
    { method: 'POST', path: /^\/api\/partner\/payments/ },
    { method: 'PUT', path: /^\/api\/partner\/payments/ },
    { method: 'POST', path: /^\/api\/partner\/employees/ },
    { method: 'POST', path: /^\/api\/partner\/companies/ },
    { method: 'POST', path: /^\/api\/partner\/transfers/ },
    { method: 'POST', path: /^\/api\/partner\/offers/ },
  ],

  // WARNING: Loggare errori e tentativi falliti
  warning: [
    { method: '*', path: /^\/api\/partner/, statusCode: [400, 401, 403, 404, 422] },
  ],

  // INFO: Letture (opzionale via config)
  info: [
    { method: 'GET', path: /^\/api\/partner\/registrations/ },
    { method: 'GET', path: /^\/api\/partner\/documents/ },
    { method: 'GET', path: /^\/api\/partner\/payments/ },
    { method: 'GET', path: /^\/api\/partner\/employees/ },
    { method: 'GET', path: /^\/api\/partner\/dashboard/ },
  ],
};

// Config: abilita/disabilita logging INFO
const LOG_INFO_OPERATIONS = process.env.LOG_INFO_OPERATIONS === 'true';

/**
 * Determina categoria log in base a metodo, path, status
 */
function getLogCategory(
  method: string,
  path: string,
  statusCode: number
): ActivityLogCategory | null {
  // Check CRITICAL
  for (const rule of LOGGING_RULES.critical) {
    if (
      (rule.method === '*' || rule.method === method) &&
      rule.path.test(path)
    ) {
      return ActivityLogCategory.CRITICAL;
    }
  }

  // Check WARNING (errori)
  if (statusCode >= 400) {
    for (const rule of LOGGING_RULES.warning) {
      if (
        (rule.method === '*' || rule.method === method) &&
        rule.path.test(path) &&
        (!rule.statusCode || rule.statusCode.includes(statusCode))
      ) {
        return ActivityLogCategory.WARNING;
      }
    }
  }

  // Check INFO (se abilitato)
  if (LOG_INFO_OPERATIONS) {
    for (const rule of LOGGING_RULES.info) {
      if (
        (rule.method === '*' || rule.method === method) &&
        rule.path.test(path)
      ) {
        return ActivityLogCategory.INFO;
      }
    }
  }

  return null; // Non loggare
}

/**
 * Estrae resourceType e resourceId dal path
 * Esempi:
 * - /api/partner/registrations/123 -> { type: 'Registration', id: '123' }
 * - /api/partner/documents/456 -> { type: 'Document', id: '456' }
 */
function extractResource(path: string): { type?: string; id?: string } {
  const patterns = [
    { regex: /\/registrations\/([a-f0-9-]+)/i, type: 'Registration' },
    { regex: /\/documents\/([a-f0-9-]+)/i, type: 'Document' },
    { regex: /\/payments\/([a-f0-9-]+)/i, type: 'Payment' },
    { regex: /\/employees\/([a-f0-9-]+)/i, type: 'PartnerEmployee' },
    { regex: /\/companies\/([a-f0-9-]+)/i, type: 'PartnerCompany' },
    { regex: /\/users\/([a-f0-9-]+)/i, type: 'User' },
    { regex: /\/offers\/([a-f0-9-]+)/i, type: 'PartnerOffer' },
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern.regex);
    if (match) {
      return { type: pattern.type, id: match[1] };
    }
  }

  return {};
}

/**
 * Genera action name da metodo e path
 */
function generateActionName(method: string, path: string): string {
  const cleanPath = path.replace(/^\/api\/partner\//, '').replace(/\/[a-f0-9-]+/gi, '/:id');

  const actionMap: Record<string, string> = {
    'POST /auth/partner/login': 'LOGIN',
    'POST /auth/2fa/verify': '2FA_VERIFY',
    'GET /registrations': 'VIEW_REGISTRATIONS',
    'GET /registrations/:id': 'VIEW_REGISTRATION_DETAIL',
    'POST /registrations': 'CREATE_REGISTRATION',
    'PUT /registrations/:id/status': 'UPDATE_REGISTRATION_STATUS',
    'GET /documents': 'VIEW_DOCUMENTS',
    'POST /documents': 'UPLOAD_DOCUMENT',
    'PUT /documents/:id': 'UPDATE_DOCUMENT',
    'DELETE /documents/:id': 'DELETE_DOCUMENT',
    'GET /payments': 'VIEW_PAYMENTS',
    'POST /payments': 'CREATE_PAYMENT',
    'PUT /payments/:id': 'UPDATE_PAYMENT',
    'GET /employees': 'VIEW_EMPLOYEES',
    'POST /employees': 'CREATE_EMPLOYEE',
    'GET /dashboard': 'VIEW_DASHBOARD',
    'POST /companies': 'CREATE_SUB_COMPANY',
    'GET /export': 'EXPORT_DATA',
  };

  const key = `${method} ${cleanPath}`;
  return actionMap[key] || `${method}_${cleanPath.toUpperCase().replace(/\//g, '_')}`;
}

/**
 * Sanitize details: rimuove dati sensibili
 */
function sanitizeDetails(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitive = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  const sanitized = { ...body };

  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Middleware principale
 */
export const activityLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Solo per route /api/partner/*
  if (!req.path.startsWith('/api/partner') && !req.path.startsWith('/api/auth/partner')) {
    return next();
  }

  const startTime = Date.now();

  // Hook su response finish
  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const category = getLogCategory(req.method, req.path, res.statusCode);

      // Skip se non da loggare
      if (!category) return;

      const resource = extractResource(req.path);
      const action = generateActionName(req.method, req.path);

      // Dati partner (da middleware auth)
      const partnerEmployee = req.partnerEmployee;

      // Se non autenticato, logga solo login/2fa attempts
      if (!partnerEmployee) {
        if (action === 'LOGIN' || action.includes('2FA')) {
          await activityLogger.log({
            partnerEmployeeId: 'anonymous',
            partnerCompanyId: 'anonymous',
            action,
            category,
            method: req.method,
            endpoint: req.path,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
            isSuccess: res.statusCode < 400,
            errorCode: res.statusCode >= 400 ? `HTTP_${res.statusCode}` : undefined,
            duration,
            details: sanitizeDetails(req.body),
          });
        }
        return;
      }

      // Log autenticato
      await activityLogger.log({
        partnerEmployeeId: partnerEmployee.id,
        partnerCompanyId: partnerEmployee.partnerCompanyId,
        action,
        category,
        method: req.method,
        endpoint: req.path,
        resourceType: resource.type,
        resourceId: resource.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        isSuccess: res.statusCode < 400,
        errorCode: res.statusCode >= 400 ? `HTTP_${res.statusCode}` : undefined,
        duration,
        details: sanitizeDetails({
          query: req.query,
          body: req.body,
        }),
      });
    } catch (error) {
      console.error('[ActivityLoggerMiddleware] Error logging activity:', error);
      // Non bloccare la richiesta in caso di errore log
    }
  });

  next();
};
