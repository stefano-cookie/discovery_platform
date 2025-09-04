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
    const token = req.headers.authorization?.split(' ')[1];
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
    const token = req.headers.authorization?.split(' ')[1];
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

// Middleware unificato che accetta entrambi i tipi
export const authenticateUnified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.type === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { partner: true }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Utente non valido' });
      }

      req.user = user;
      req.partner = user.partner;
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