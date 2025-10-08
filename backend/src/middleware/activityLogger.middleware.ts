/**
 * Activity Logger Middleware
 *
 * Intercetta automaticamente TUTTE le richieste dei partner e logga:
 * - Operazioni CRITICAL: login, documenti, pagamenti, trasferimenti
 * - Operazioni WARNING: errori, tentativi falliti
 * - Operazioni INFO: letture, navigazione (configurabile)
 */

import { Request, Response, NextFunction } from 'express';
import { ActivityLogCategory, PrismaClient } from '@prisma/client';
import { activityLogger } from '../services/activityLogger.service';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
    { method: 'POST', path: /^\/api\/partners\/registrations/ },
    { method: 'POST', path: /^\/api\/registration/ },
    { method: 'PUT', path: /^\/api\/partners\/registrations\/[^/]+\/status/ },
    { method: 'PUT', path: /^\/api\/registration\/[^/]+\/status/ },
    { method: 'POST', path: /^\/api\/partners\/documents/ },
    { method: 'POST', path: /^\/api\/document-upload/ },
    { method: 'PUT', path: /^\/api\/partners\/documents/ },
    { method: 'DELETE', path: /^\/api\/partners\/documents/ },
    { method: 'POST', path: /^\/api\/payments/ },
    { method: 'PUT', path: /^\/api\/payments/ },
    { method: 'POST', path: /^\/api\/partner-employees/ },
    { method: 'PUT', path: /^\/api\/partner-employees/ },
    { method: 'DELETE', path: /^\/api\/partner-employees/ },
    { method: 'POST', path: /^\/api\/sub-partners/ },
    { method: 'POST', path: /^\/api\/partners\/offers/ },
    { method: 'POST', path: /^\/api\/partners\/coupons/ },
    { method: 'PUT', path: /^\/api\/partners\/coupons/ },
  ],

  // WARNING: Loggare errori e tentativi falliti
  warning: [
    { method: '*', path: /^\/api\/partners/, statusCode: [400, 401, 403, 404, 422] },
    { method: '*', path: /^\/api\/partner-employees/, statusCode: [400, 401, 403, 404, 422] },
    { method: '*', path: /^\/api\/sub-partners/, statusCode: [400, 401, 403, 404, 422] },
    { method: '*', path: /^\/api\/payments/, statusCode: [400, 401, 403, 404, 422] },
    { method: '*', path: /^\/api\/registration/, statusCode: [400, 401, 403, 404, 422] },
  ],

  // INFO: Letture (opzionale via config)
  info: [
    { method: 'GET', path: /^\/api\/partners\/registrations/ },
    { method: 'GET', path: /^\/api\/partners\/users/ },
    { method: 'GET', path: /^\/api\/partners\/documents/ },
    { method: 'GET', path: /^\/api\/payments/ },
    { method: 'GET', path: /^\/api\/partner-employees/ },
    { method: 'GET', path: /^\/api\/partners\/dashboard/ },
    { method: 'GET', path: /^\/api\/partners\/stats/ },
  ],
};

// Config: abilita/disabilita logging INFO
const LOG_INFO_OPERATIONS = process.env.LOG_INFO_OPERATIONS === 'true';

/**
 * Estrae dati partner dal JWT token
 */
async function extractPartnerFromToken(req: Request): Promise<{
  id: string;
  partnerCompanyId: string;
  email: string;
} | null> {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token as string;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Solo token di tipo partner
    if (decoded.type !== 'partner') return null;

    // Se già popolato da middleware auth, usalo
    if (req.partnerEmployee) {
      return {
        id: req.partnerEmployee.id,
        partnerCompanyId: req.partnerEmployee.partnerCompanyId,
        email: req.partnerEmployee.email,
      };
    }

    // Altrimenti, carica da database
    const partnerEmployee = await prisma.partnerEmployee.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        partnerCompanyId: true,
      },
    });

    return partnerEmployee;
  } catch (error) {
    return null;
  }
}

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
 * - /api/partners/registrations/123 -> { type: 'Registration', id: '123' }
 * - /api/partners/documents/456 -> { type: 'Document', id: '456' }
 */
function extractResource(path: string): { type?: string; id?: string } {
  const patterns = [
    { regex: /\/registrations?\/([a-f0-9-]+)/i, type: 'Registration' },
    { regex: /\/documents?\/([a-f0-9-]+)/i, type: 'Document' },
    { regex: /\/payments?\/([a-f0-9-]+)/i, type: 'Payment' },
    { regex: /\/partner-employees\/([a-f0-9-]+)/i, type: 'PartnerEmployee' },
    { regex: /\/sub-partners\/([a-f0-9-]+)/i, type: 'PartnerCompany' },
    { regex: /\/users\/([a-f0-9-]+)/i, type: 'User' },
    { regex: /\/offers\/([a-f0-9-]+)/i, type: 'PartnerOffer' },
    { regex: /\/coupons\/([a-f0-9-]+)/i, type: 'Coupon' },
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
  const cleanPath = path
    .replace(/^\/api\/partners?\//, '')
    .replace(/^\/api\/partner-employees\//, 'employees/')
    .replace(/^\/api\/sub-partners\//, 'sub-partners/')
    .replace(/^\/api\/registration\//, 'registrations/')
    .replace(/^\/api\/payments\//, 'payments/')
    .replace(/^\/api\/document-upload\//, 'documents/')
    .replace(/\/[a-f0-9-]+/gi, '/:id');

  const actionMap: Record<string, string> = {
    'POST /auth/partner/login': 'LOGIN',
    'POST /auth/2fa/verify': '2FA_VERIFY',
    'GET registrations': 'VIEW_REGISTRATIONS',
    'GET registrations/:id': 'VIEW_REGISTRATION_DETAIL',
    'POST registrations': 'CREATE_REGISTRATION',
    'PUT registrations/:id/status': 'UPDATE_REGISTRATION_STATUS',
    'GET users': 'VIEW_USERS',
    'GET users/:id': 'VIEW_USER_DETAIL',
    'GET documents': 'VIEW_DOCUMENTS',
    'POST documents': 'UPLOAD_DOCUMENT',
    'PUT documents/:id': 'UPDATE_DOCUMENT',
    'DELETE documents/:id': 'DELETE_DOCUMENT',
    'GET payments': 'VIEW_PAYMENTS',
    'POST payments': 'CREATE_PAYMENT',
    'PUT payments/:id': 'UPDATE_PAYMENT',
    'GET employees': 'VIEW_EMPLOYEES',
    'POST employees': 'INVITE_EMPLOYEE',
    'PUT employees/:id': 'UPDATE_EMPLOYEE',
    'DELETE employees/:id': 'REMOVE_EMPLOYEE',
    'GET dashboard': 'VIEW_DASHBOARD',
    'GET stats': 'VIEW_STATS',
    'POST sub-partners': 'CREATE_SUB_PARTNER',
    'POST coupons': 'CREATE_COUPON',
    'PUT coupons/:id': 'UPDATE_COUPON',
    'GET export': 'EXPORT_DATA',
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
 * Verifica se il path è rilevante per partner logging
 */
function isPartnerRelevantPath(path: string): boolean {
  const relevantPaths = [
    /^\/api\/partners/,
    /^\/api\/partner-employees/,
    /^\/api\/sub-partners/,
    /^\/api\/registration/,
    /^\/api\/payments/,
    /^\/api\/document-upload/,
    /^\/api\/auth\/partner/,
    /^\/api\/auth\/2fa/,
  ];

  return relevantPaths.some(regex => regex.test(path));
}

/**
 * Middleware principale
 */
export const activityLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Solo per route rilevanti per i partner
  if (!isPartnerRelevantPath(req.path)) {
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

      // Estrai dati partner (da middleware auth o da JWT diretto)
      const partnerEmployee = await extractPartnerFromToken(req);

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
