import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: any;
  partner?: any;
  partnerEmployee?: any;
  partnerCompany?: any;
}

// Middleware per User (clienti)
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Support token from Authorization header or query parameter (for downloads)
    const token = req.headers.authorization?.split(' ')[1] || req.query.token as string;
    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Controlla il type del token
    if (decoded.type !== 'user') {
      return res.status(401).json({ error: 'Token non valido per questa risorsa' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { partner: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Utente non valido' });
    }

    // Special handling for 2FA setup tokens
    // If token has requires2FASetup flag, only allow access to 2FA endpoints
    if (decoded.requires2FASetup) {
      // Check if the request is for a 2FA endpoint
      // OriginalUrl will be like /api/user/2fa/setup (full URL)
      const is2FAEndpoint =
        req.originalUrl?.includes('/user/2fa') ||
        req.originalUrl?.includes('/auth/2fa') ||
        req.path.includes('2fa');

      console.log('[Auth Middleware] 2FA Setup Token detected:', {
        path: req.path,
        originalUrl: req.originalUrl,
        url: req.url,
        is2FAEndpoint
      });

      if (!is2FAEndpoint) {
        return res.status(403).json({
          error: 'Devi completare la configurazione 2FA prima di accedere a questa risorsa',
          requires2FASetup: true
        });
      }
    }

    req.user = user;
    req.partner = user.partner;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

// Middleware per PartnerEmployee (collaboratori aziende)
export const authenticatePartner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Support token from Authorization header or query parameter (for downloads)
    const token = req.headers.authorization?.split(' ')[1] || req.query.token as string;
    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Controlla il type del token
    if (decoded.type !== 'partner') {
      return res.status(401).json({ error: 'Token non valido per questa risorsa' });
    }
    
    const partnerEmployee = await prisma.partnerEmployee.findUnique({
      where: { id: decoded.id },
      include: { 
        partnerCompany: true 
      }
    });

    if (!partnerEmployee || !partnerEmployee.isActive) {
      return res.status(401).json({ error: 'Collaboratore non valido' });
    }

    if (!partnerEmployee.partnerCompany.isActive) {
      return res.status(401).json({ error: 'Azienda partner non attiva' });
    }

    req.partnerEmployee = partnerEmployee;
    req.partnerCompany = partnerEmployee.partnerCompany;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

// Middleware unificato che accetta user, partner e admin tokens
export const authenticateUnified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Support token from Authorization header or query parameter (for downloads)
    const token = req.headers.authorization?.split(' ')[1] || req.query.token as string;
    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (decoded.type === 'admin') {
      const adminAccount = await prisma.adminAccount.findUnique({
        where: { id: decoded.id },
        include: { user: true }
      });

      if (!adminAccount || !adminAccount.isActive) {
        return res.status(401).json({ error: 'Account admin non valido' });
      }

      if (!adminAccount.user || !adminAccount.user.isActive) {
        return res.status(401).json({ error: 'Utente collegato non valido' });
      }

      // Set req.user to the underlying User record with admin metadata
      req.user = {
        ...adminAccount.user,
        adminAccountId: adminAccount.id,
        type: 'admin'
      };
    } else if (decoded.type === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { partner: true }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Utente non valido' });
      }

      req.user = { ...user, type: 'user' };
      req.partner = user.partner;

      // For legacy partners, find the corresponding PartnerCompany
      if (user.role === 'PARTNER' && user.partner) {
        const partnerCompany = await prisma.partnerCompany.findFirst({
          where: { referralCode: user.partner.referralCode }
        });

        if (partnerCompany) {
          req.partnerCompany = partnerCompany;
        }
      }
    } else if (decoded.type === 'partner') {
      const partnerEmployee = await prisma.partnerEmployee.findUnique({
        where: { id: decoded.id },
        include: { partnerCompany: true }
      });

      if (!partnerEmployee || !partnerEmployee.isActive) {
        return res.status(401).json({ error: 'Collaboratore non valido' });
      }

      req.partnerEmployee = partnerEmployee;
      req.partnerCompany = partnerEmployee.partnerCompany;
      req.user = { ...partnerEmployee, type: 'partner' } as any;
    } else {
      return res.status(401).json({ error: 'Tipo token non riconosciuto' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    next();
  };
};

// Middleware per permessi partner
export const requirePartnerRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.partnerEmployee || !roles.includes(req.partnerEmployee.role)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    next();
  };
};

// Middleware per Admin (account amministrativi)
export const authenticateAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Support token from Authorization header or query parameter (for downloads)
    const token = req.headers.authorization?.split(' ')[1] || req.query.token as string;
    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Controlla il type del token
    if (decoded.type !== 'admin') {
      return res.status(401).json({ error: 'Token non valido per questa risorsa' });
    }

    const adminAccount = await prisma.adminAccount.findUnique({
      where: { id: decoded.id },
      include: { user: true }
    });

    if (!adminAccount || !adminAccount.isActive) {
      return res.status(401).json({ error: 'Account admin non valido' });
    }

    if (!adminAccount.user || !adminAccount.user.isActive) {
      return res.status(401).json({ error: 'Utente collegato non valido' });
    }

    // Set req.user to the underlying User record for compatibility
    req.user = {
      ...adminAccount.user,
      adminAccountId: adminAccount.id
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};