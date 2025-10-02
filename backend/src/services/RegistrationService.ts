import { PrismaClient, RegistrationStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class RegistrationService {
  /**
   * Lista registrazioni globali con filtri
   */
  async listRegistrations(filters?: {
    companyId?: string;
    courseId?: string;
    status?: RegistrationStatus[];
    offerType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    hasCommission?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      companyId,
      courseId,
      status,
      offerType,
      dateFrom,
      dateTo,
      hasCommission,
      page = 1,
      limit = 50
    } = filters || {};

    const where: any = {};

    if (companyId) where.partnerCompanyId = companyId;
    if (courseId) where.courseId = courseId;
    if (status && status.length > 0) where.status = { in: status };
    if (offerType) where.offerType = offerType;
    if (hasCommission) where.partnerCommission = { not: null, gt: 0 };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          status: true,
          offerType: true,
          finalAmount: true,
          originalAmount: true,
          partnerCommission: true,
          installments: true,
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  nome: true,
                  cognome: true,
                  codiceFiscale: true
                }
              }
            }
          },
          partnerCompany: {
            select: {
              id: true,
              name: true,
              referralCode: true
            }
          },
          offer: {
            select: {
              id: true,
              name: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  templateType: true
                }
              }
            }
          },
          deadlines: {
            select: {
              isPaid: true,
              paymentStatus: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.registration.count({ where })
    ]);

    return {
      registrations: registrations.map(r => ({
        ...r,
        finalAmount: Number(r.finalAmount),
        originalAmount: Number(r.originalAmount),
        partnerCommission: r.partnerCommission ? Number(r.partnerCommission) : null,
        course: r.offer?.course || null,
        hasPaidPayments: r.deadlines?.some((d: any) => d.isPaid === true || d.paymentStatus === 'PAID') || false
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Dettaglio registrazione singola
   */
  async getRegistrationById(id: string) {
    console.log('🔍 [RegistrationService] getRegistrationById called with ID:', id);

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        },
        partnerCompany: {
          select: {
            id: true,
            name: true,
            referralCode: true,
            isPremium: true
          }
        },
        offer: {
          select: {
            id: true,
            name: true,
            totalAmount: true,
            course: {
              select: {
                id: true,
                name: true,
                templateType: true
              }
            }
          }
        },
        userDocuments: {
          where: {
            registrationId: id // Solo documenti di questa registration
          },
          select: {
            id: true,
            type: true,
            status: true,
            url: true,
            uploadedAt: true,
            partnerCheckedAt: true,
            partnerCheckedBy: true,
            discoveryApprovedAt: true,
            discoveryApprovedBy: true,
            discoveryRejectedAt: true,
            discoveryRejectionReason: true,
            uploadSource: true,
            originalName: true,
            mimeType: true,
            size: true
          },
          orderBy: {
            uploadedAt: 'desc' // Più recente prima
          }
        }
      }
    });

    console.log('📋 [RegistrationService] Found documents count (raw):', registration?.userDocuments?.length || 0);
    console.log('📋 [RegistrationService] Documents (raw):', registration?.userDocuments?.map(d => ({
      id: d.id,
      type: d.type,
      originalName: d.originalName,
      uploadedAt: d.uploadedAt
    })));

    // Deduplicare documenti: prendi solo l'ultimo per ogni tipo
    if (registration && registration.userDocuments) {
      const docsByType = new Map<string, any>();

      // I documenti sono già ordinati per uploadedAt DESC (più recente prima)
      // Quindi il primo che troviamo di ogni tipo è il più recente
      for (const doc of registration.userDocuments) {
        if (!docsByType.has(doc.type)) {
          docsByType.set(doc.type, doc);
        }
      }

      registration.userDocuments = Array.from(docsByType.values());

      console.log('📋 [RegistrationService] Documents count (deduplicated):', registration.userDocuments.length);
      console.log('📋 [RegistrationService] Documents (deduplicated):', registration.userDocuments.map(d => ({
        id: d.id,
        type: d.type,
        originalName: d.originalName,
        uploadedAt: d.uploadedAt
      })));
    }

    return registration;
  }

  /**
   * Trasferisci registrazione a altra company
   */
  async transferRegistration(
    registrationId: string,
    toCompanyId: string,
    adminId: string,
    reason: string,
    ipAddress?: string
  ) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        userId: true,
        partnerId: true,
        partnerCompanyId: true,
        courseId: true,
        finalAmount: true
      }
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    const toCompany = await prisma.partnerCompany.findUnique({
      where: { id: toCompanyId }
    });

    if (!toCompany) {
      throw new Error('Target company not found');
    }

    return await prisma.$transaction(async (tx) => {
      // Aggiorna registrazione
      const updated = await tx.registration.update({
        where: { id: registrationId },
        data: {
          partnerCompanyId: toCompanyId
        }
      });

      // Log transfer
      // Note: UserTransfer model richiede partnerId (legacy), usiamo lo stesso per from/to
      await tx.userTransfer.create({
        data: {
          userId: registration.userId,
          fromPartnerId: registration.partnerId || '',
          toPartnerId: registration.partnerId || '',
          fromPartnerCompanyId: registration.partnerCompanyId,
          toPartnerCompanyId: toCompanyId,
          transferredBy: adminId,
          reason,
          transferredAt: new Date()
        }
      });

      // Log azione Discovery
      await tx.discoveryAdminLog.create({
        data: {
          adminId,
          action: 'REGISTRATION_TRANSFER',
          targetType: 'REGISTRATION',
          targetId: registrationId,
          previousValue: {
            companyId: registration.partnerCompanyId
          },
          newValue: {
            companyId: toCompanyId
          },
          reason,
          ipAddress
        }
      });

      return updated;
    });
  }

  /**
   * Statistiche registrazioni per dashboard
   */
  async getRegistrationStats(filters?: {
    companyId?: string;
    courseId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const where: any = {};

    if (filters?.companyId) where.partnerCompanyId = filters.companyId;
    if (filters?.courseId) where.courseId = filters.courseId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [total, byStatus, revenue] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.registration.aggregate({
        where,
        _sum: {
          finalAmount: true,
          partnerCommission: true
        }
      })
    ]);

    return {
      total,
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count
      })),
      totalRevenue: revenue._sum?.finalAmount ? Number(revenue._sum.finalAmount) : 0,
      totalPartnerCommissions: revenue._sum?.partnerCommission
        ? Number(revenue._sum.partnerCommission)
        : 0
    };
  }
}

export default new RegistrationService();