import { Router } from 'express';
import { AuthRequest, authenticatePartner } from '../middleware/auth';

const router = Router();

// GET /stats - Partner basic stats with real data from database
router.get('/stats', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Get real data from database for this partner
      const registrations = await prisma.registration.findMany({
        where: {
          OR: [
            { partnerId: partnerCompanyId }, // Legacy field
            { partnerCompanyId: partnerCompanyId } // New field
          ]
        }
      });

      // Calculate stats
      const totalRegistrations = registrations.length;
      const directRegistrations = registrations.filter((r: any) => r.isDirectRegistration !== false).length;
      const indirectRegistrations = totalRegistrations - directRegistrations;
      
      // Calculate monthly revenue (current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const monthlyRegistrations = registrations.filter((r: any) => {
        const regDate = new Date(r.createdAt);
        return regDate >= startOfMonth && regDate <= endOfMonth;
      });
      
      const monthlyRevenue = monthlyRegistrations
        .filter((r: any) => r.finalAmount)
        .reduce((sum: number, r: any) => sum + Number(r.finalAmount), 0);

      res.json({
        totalRegistrations,
        directRegistrations,  
        indirectRegistrations,
        monthlyRevenue
      });

    } catch (dbError) {
      console.error('Database error in stats:', dbError);
      res.status(500).json({ error: 'Errore nel caricamento dati dal database' });
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('Get partner stats error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /analytics - Partner analytics with real data from database
router.get('/analytics', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Get real data from database
      const registrations = await prisma.registration.findMany({
        where: {
          OR: [
            { partnerId: partnerCompanyId }, // Legacy field
            { partnerCompanyId: partnerCompanyId } // New field
          ]
        },
        include: {
          user: {
            select: { email: true }
          }
        }
      });

      // Calculate real metrics
      const totalRegistrations = registrations.length;
      const enrolledCount = registrations.filter((r: any) => r.status === 'ENROLLED').length;
      const pendingCount = registrations.filter((r: any) => r.status === 'PENDING').length;
      const completedCount = registrations.filter((r: any) => r.status === 'COMPLETED').length;
      
      const totalRevenue = registrations
        .filter((r: any) => r.finalAmount)
        .reduce((sum: number, r: any) => sum + Number(r.finalAmount), 0);

      // Generate revenue chart based on real data or fallback
      const now = new Date();
      const monthsData = [];
      
      for (let i = 5; i >= 0; i--) {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = startDate.toLocaleDateString('it-IT', { month: 'short' });
        
        // Filter registrations for this month
        const monthRegistrations = registrations.filter((r: any) => {
          const regDate = new Date(r.createdAt);
          return regDate >= startDate && regDate <= endDate;
        });
        
        const monthRevenue = monthRegistrations
          .filter((r: any) => r.finalAmount)
          .reduce((sum: number, r: any) => sum + Number(r.finalAmount), 0);

        monthsData.push({
          month: monthName,
          revenue: monthRevenue,
          target: 1000 // Keep target as mock for now
        });
      }

      const statusData = [
        { status: 'PENDING', count: pendingCount },
        { status: 'ENROLLED', count: enrolledCount },
        { status: 'COMPLETED', count: completedCount }
      ];

      // Growth data based on registration dates
      const growthData = [];
      for (let i = 5; i >= 0; i--) {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = startDate.toLocaleDateString('it-IT', { month: 'short' });
        
        const monthRegistrations = registrations.filter((r: any) => {
          const regDate = new Date(r.createdAt);
          return regDate >= startDate && regDate <= endDate;
        });
        
        growthData.push({
          month: monthName,
          users: monthRegistrations.length
        });
      }

      // Calculate conversion rate (enrolled/total)
      const conversionRate = totalRegistrations > 0 ? Math.round((enrolledCount / totalRegistrations) * 100) : 0;
      
      // For now, keep some metrics as mock since we don't have document system data
      const documentsUpload = 0; // No real document data available
      const contractGenerated = 0; // No real contract data available  
      const contractSigned = 0; // No real contract data available

      // Calculate average revenue per user
      const avgRevenuePerUser = totalRegistrations > 0 ? Math.round(totalRevenue / totalRegistrations) : 0;
      
      // Calculate growth rate
      const growthRate = growthData.length > 1 ? 
        Math.round(((growthData[growthData.length - 1].users - growthData[0].users) / Math.max(growthData[0].users, 1)) * 100) : 0;

      res.json({
        revenueChart: monthsData,
        statusDistribution: statusData,
        userGrowth: growthData,
        metrics: {
          conversionRate,
          avgRevenuePerUser,
          growthRate
        },
        pendingActions: {
          documentsToApprove: documentsUpload,
          contractsToSign: contractGenerated,
          paymentsInProgress: contractSigned,
          completedEnrollments: completedCount
        }
      });

    } catch (dbError) {
      console.error('Database error in analytics:', dbError);
      res.status(500).json({ error: 'Errore nel caricamento dati dal database' });
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('Get partner analytics error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;// File updated
