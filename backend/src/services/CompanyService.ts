import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { R2CleanupService } from './r2CleanupService';

const prisma = new PrismaClient();

export class CompanyService {
  /**
   * Lista tutte le company con statistiche
   */
  async listCompanies() {
    return await prisma.partnerCompany.findMany({
      select: {
        id: true,
        name: true,
        referralCode: true,
        isActive: true,
        isPremium: true,
        canCreateChildren: true,
        totalEarnings: true,
        commissionPerUser: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            employees: true,
            registrations: true,
            children: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Ottieni dettaglio company singola
   */
  async getCompanyById(id: string) {
    return await prisma.partnerCompany.findUnique({
      where: { id },
      include: {
        registrations: {
          select: {
            id: true,
            createdAt: true,
            offerType: true,
            finalAmount: true,
            originalAmount: true,
            partnerCommission: true,
            status: true,
            user: {
              select: {
                email: true,
                profile: {
                  select: {
                    nome: true,
                    cognome: true
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
          take: 20
        },
        employees: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isOwner: true,
            isActive: true,
            createdAt: true
          },
          orderBy: {
            isOwner: 'desc'
          }
        },
        children: {
          select: {
            id: true,
            name: true,
            referralCode: true,
            isActive: true,
            _count: {
              select: {
                registrations: true
              }
            }
          }
        },
        parent: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        },
        _count: {
          select: {
            registrations: true,
            employees: true,
            children: true
          }
        }
      }
    });
  }

  /**
   * Crea nuova company con primo admin
   */
  async createCompany(data: {
    name: string;
    referralCode: string;
    isPremium: boolean;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
    adminId: string; // Discovery admin che crea
    ipAddress?: string;
  }) {
    const {
      name,
      referralCode,
      isPremium,
      adminEmail,
      adminFirstName,
      adminLastName,
      adminId,
      ipAddress
    } = data;

    // Verifica referral code univoco
    const existingCompany = await prisma.partnerCompany.findUnique({
      where: { referralCode }
    });

    if (existingCompany) {
      throw new Error('Referral code already exists');
    }

    // Verifica email admin univoca
    const existingEmployee = await prisma.partnerEmployee.findUnique({
      where: { email: adminEmail }
    });

    if (existingEmployee) {
      throw new Error('Admin email already exists');
    }

    // Crea company + primo admin in transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Crea company
      const company = await tx.partnerCompany.create({
        data: {
          name,
          referralCode,
          isPremium,
          canCreateChildren: isPremium,
          isActive: true,
          commissionPerUser: new Prisma.Decimal(0),
          totalEarnings: new Prisma.Decimal(0)
        }
      });

      // 2. Genera token invito sicuro
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // 3. Crea primo employee (owner)
      const admin = await tx.partnerEmployee.create({
        data: {
          partnerCompanyId: company.id,
          email: adminEmail,
          firstName: adminFirstName,
          lastName: adminLastName,
          password: '',
          role: 'ADMINISTRATIVE',
          isOwner: true,
          isActive: true,
          inviteToken,
          inviteExpiresAt
        }
      });

      // 4. Log azione admin Discovery
      await tx.discoveryAdminLog.create({
        data: {
          adminId,
          action: 'COMPANY_CREATE',
          targetType: 'COMPANY',
          targetId: company.id,
          newValue: {
            name,
            referralCode,
            isPremium,
            adminEmail
          },
          reason: 'Company created by Discovery admin',
          ipAddress,
          createdAt: new Date()
        }
      });

      return { company, admin, inviteToken };
    });
  }

  /**
   * Aggiorna company
   */
  async updateCompany(
    id: string,
    data: {
      name?: string;
      isActive?: boolean;
      isPremium?: boolean;
      canCreateChildren?: boolean;
      commissionPerUser?: number;
    },
    adminId: string,
    ipAddress?: string
  ) {
    const currentCompany = await prisma.partnerCompany.findUnique({
      where: { id }
    });

    if (!currentCompany) {
      throw new Error('Company not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isPremium !== undefined) updateData.isPremium = data.isPremium;
    if (data.canCreateChildren !== undefined) updateData.canCreateChildren = data.canCreateChildren;
    if (data.commissionPerUser !== undefined) updateData.commissionPerUser = new Prisma.Decimal(data.commissionPerUser);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.partnerCompany.update({
        where: { id },
        data: updateData
      });

      await tx.discoveryAdminLog.create({
        data: {
          adminId,
          action: 'COMPANY_EDIT',
          targetType: 'COMPANY',
          targetId: id,
          previousValue: {
            name: currentCompany.name,
            isActive: currentCompany.isActive,
            isPremium: currentCompany.isPremium,
            commissionPerUser: currentCompany.commissionPerUser.toNumber()
          },
          newValue: updateData,
          reason: 'Company updated by Discovery admin',
          ipAddress
        }
      });

      return updated;
    });

    return result;
  }

  /**
   * Disattiva company
   */
  async disableCompany(id: string, adminId: string, ipAddress?: string) {
    return await this.updateCompany(
      id,
      { isActive: false },
      adminId,
      ipAddress
    );
  }

  /**
   * Elimina company completamente (hard delete)
   * Elimina anche tutti i dati associati: employees, registrations, offers, etc.
   */
  async deleteCompany(id: string, adminId: string, ipAddress?: string) {
    const company = await prisma.partnerCompany.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
            registrations: true,
            children: true
          }
        }
      }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Verifica se ha sub-partner
    if (company._count.children > 0) {
      throw new Error('Cannot delete company with active sub-partners');
    }

    return await prisma.$transaction(async (tx) => {
      // 0. Trova tutti gli utenti assegnati a questa company
      const assignedUsers = await tx.user.findMany({
        where: { assignedPartnerCompanyId: id },
        select: { id: true, email: true }
      });
      const assignedUserIds = assignedUsers.map(u => u.id);

      console.log(`🗑️ Deleting company ${company.name} with ${assignedUserIds.length} assigned users`);

      // 1. Elimina TUTTI i documenti degli utenti assegnati (database + R2)
      // Questo include documenti delle registrations E documenti orfani/in bozza
      const { DocumentCleanupService } = await import('./documentCleanupService');

      if (assignedUserIds.length > 0) {
        console.log(`🗑️  Deleting all documents for ${assignedUserIds.length} users...`);
        for (const userId of assignedUserIds) {
          const deletedCount = await DocumentCleanupService.deleteUserDocuments(userId);
          console.log(`   ✅ User ${userId}: ${deletedCount} documents deleted from R2+DB`);
        }
      }

      // 2. Elimina payment deadlines
      await tx.paymentDeadline.deleteMany({
        where: {
          registrationId: {
            in: await tx.registration.findMany({
              where: { partnerCompanyId: id },
              select: { id: true }
            }).then(regs => regs.map(r => r.id))
          }
        }
      });

      // 3. Elimina registrations
      await tx.registration.deleteMany({
        where: { partnerCompanyId: id }
      });

      // 4. Elimina UserOfferAccess legati alle offer della company
      const offerIds = await tx.partnerOffer.findMany({
        where: { partnerCompanyId: id },
        select: { id: true }
      }).then(offers => offers.map(o => o.id));

      if (offerIds.length > 0) {
        await tx.userOfferAccess.deleteMany({
          where: { offerId: { in: offerIds } }
        });
      }

      // 5. Elimina offers
      await tx.partnerOffer.deleteMany({
        where: { partnerCompanyId: id }
      });

      // 6. Elimina ActionTokens legati agli employees della company
      const employeeIds = await tx.partnerEmployee.findMany({
        where: { partnerCompanyId: id },
        select: { id: true }
      }).then(employees => employees.map(e => e.id));

      if (employeeIds.length > 0) {
        await tx.actionToken.deleteMany({
          where: { partnerEmployeeId: { in: employeeIds } }
        });
      }

      // 7. Elimina employees
      await tx.partnerEmployee.deleteMany({
        where: { partnerCompanyId: id }
      });

      // 8. Elimina utenti assegnati alla company (User records)
      if (assignedUserIds.length > 0) {
        // 8a. Elimina UserOfferAccess degli utenti
        await tx.userOfferAccess.deleteMany({
          where: { userId: { in: assignedUserIds } }
        });

        // 8b. Elimina ChatConversation degli utenti (se esistono)
        await tx.chatConversation.deleteMany({
          where: { userId: { in: assignedUserIds } }
        });

        // 8c. Elimina UserProfile degli utenti
        await tx.userProfile.deleteMany({
          where: { userId: { in: assignedUserIds } }
        });

        // 8d. Elimina UserTransfer records
        await tx.userTransfer.deleteMany({
          where: {
            OR: [
              { userId: { in: assignedUserIds } },
              { fromPartnerId: id },
              { toPartnerId: id }
            ]
          }
        });

        // 8e. Elimina User records
        await tx.user.deleteMany({
          where: { id: { in: assignedUserIds } }
        });

        console.log(`✅ Deleted ${assignedUserIds.length} users assigned to company ${company.name}`);
      }

      // 9. Log dell'azione
      await tx.discoveryAdminLog.create({
        data: {
          adminId,
          action: 'COMPANY_DELETE',
          targetType: 'COMPANY',
          targetId: id,
          previousValue: {
            name: company.name,
            referralCode: company.referralCode,
            employeesCount: company._count.employees,
            registrationsCount: company._count.registrations,
            assignedUsersCount: assignedUserIds.length,
            assignedUserEmails: assignedUsers.map(u => u.email)
          },
          reason: 'Company deleted by Discovery admin',
          ipAddress
        }
      });

      // 10. Elimina company
      await tx.partnerCompany.delete({
        where: { id }
      });

      return { success: true, deletedCompany: company.name };
    });
  }

  /**
   * Ottieni revenue dettagliato per tutte le company
   */
  async getCompanyRevenue() {
    const companies = await prisma.partnerCompany.findMany({
      where: { isActive: true },
      include: {
        registrations: {
          select: {
            id: true,
            finalAmount: true,
            partnerCommission: true,
            offerType: true,
            offer: {
              select: {
                course: {
                  select: {
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
          }
        }
      }
    });

    return companies.map(company => {
      // Filtra solo registrazioni con almeno un pagamento effettuato
      const paidRegistrations = company.registrations.filter(reg =>
        reg.deadlines.some(d => d.isPaid === true || d.paymentStatus === 'PAID')
      );

      // Calcola totali solo sulle iscrizioni pagate
      const totalRegistrations = paidRegistrations.length;
      const totalRevenue = paidRegistrations.reduce(
        (sum, reg) => sum + Number(reg.finalAmount),
        0
      );

      // Breakdown per tipo offerta (solo iscrizioni pagate)
      const byOfferType = paidRegistrations.reduce((acc: any, reg) => {
        const type = reg.offerType || 'UNKNOWN';
        if (!acc[type]) {
          acc[type] = { offerType: type, count: 0, revenue: 0 };
        }
        acc[type].count++;
        acc[type].revenue += Number(reg.finalAmount);
        return acc;
      }, {});

      // Breakdown per corso (solo iscrizioni pagate)
      const byCourse = paidRegistrations.reduce((acc: any, reg) => {
        const courseName = reg.offer?.course?.name || 'Sconosciuto';
        const courseType = reg.offer?.course?.templateType || 'UNKNOWN';
        const key = `${courseName}-${courseType}`;

        if (!acc[key]) {
          acc[key] = { courseName, courseType, count: 0, revenue: 0 };
        }
        acc[key].count++;
        acc[key].revenue += Number(reg.finalAmount);
        return acc;
      }, {});

      return {
        company: {
          id: company.id,
          name: company.name,
          referralCode: company.referralCode,
          isPremium: company.isPremium,
          commissionPerUser: Number(company.commissionPerUser)
        },
        totalRegistrations,
        totalRevenue,
        byOfferType: Object.values(byOfferType),
        byCourse: Object.values(byCourse)
      };
    });
  }

  /**
   * Statistiche dashboard globale
   */
  async getDashboardStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCompanies,
      activeCompanies,
      totalRegistrations,
      registrationsToday,
      registrationsThisWeek,
      registrationsThisMonth,
      statusDistribution,
      topCompanies
    ] = await Promise.all([
      prisma.partnerCompany.count(),
      prisma.partnerCompany.count({ where: { isActive: true } }),
      prisma.registration.count(),
      prisma.registration.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.registration.count({
        where: { createdAt: { gte: weekAgo } }
      }),
      prisma.registration.count({
        where: { createdAt: { gte: monthAgo } }
      }),
      prisma.registration.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.partnerCompany.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          referralCode: true,
          totalEarnings: true,
          commissionPerUser: true,
          isPremium: true,
          _count: {
            select: {
              registrations: true
            }
          }
        },
        orderBy: {
          totalEarnings: 'desc'
        },
        take: 5
      })
    ]);

    // Calcola revenue solo dalle iscrizioni con pagamenti registrati
    const paidRegistrations = await prisma.registration.findMany({
      where: {
        deadlines: {
          some: {
            OR: [
              { isPaid: true },
              { paymentStatus: 'PAID' }
            ]
          }
        }
      },
      select: {
        finalAmount: true
      }
    });

    const totalRevenue = paidRegistrations.reduce(
      (sum, reg) => sum + Number(reg.finalAmount),
      0
    );

    // Format top companies
    const formattedTopCompanies = topCompanies.map(company => ({
      id: company.id,
      name: company.name,
      registrations: company._count.registrations,
      revenue: Number(company.totalEarnings),
      commissionPerUser: Number(company.commissionPerUser),
      isPremium: company.isPremium
    }));

    // Format status distribution
    const formattedStatusDistribution = statusDistribution.map(item => ({
      status: item.status,
      count: item._count
    }));

    return {
      summary: {
        totalCompanies,
        activeCompanies,
        totalRegistrations,
        totalRevenue,
        registrationsToday,
        registrationsThisWeek,
        registrationsThisMonth
      },
      revenueChart: [],
      registrationsChart: [],
      statusDistribution: formattedStatusDistribution,
      topCompanies: formattedTopCompanies
    };
  }
}

export default new CompanyService();