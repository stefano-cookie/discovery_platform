import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class OfferInheritanceService {
  /**
   * Genera hash casuale per referral link
   */
  private static generateOfferHash(length: number = 11): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length)
      .toUpperCase();
  }

  /**
   * Genera referral link per sub-partner nel formato: PARENT001-CHILD001-TYPE-HASH
   */
  private static generateSubPartnerReferralLink(
    parentCode: string, 
    childCode: string,
    offerType: string
  ): string {
    const hash = this.generateOfferHash();
    const typeCode = offerType === 'TFA_ROMANIA' ? 'TFA' : 'CERTIFICATION';
    return `${parentCode}-${childCode}-${typeCode}-${hash}`;
  }

  /**
   * Crea offerte ereditate automaticamente per un sub-partner
   */
  static async createInheritedOffers(
    parentCompanyId: string, 
    childCompanyId: string
  ): Promise<number> {
    try {
      // Get parent company info
      const parentCompany = await prisma.partnerCompany.findUnique({
        where: { id: parentCompanyId },
        select: { referralCode: true, name: true }
      });

      // Get child company info
      const childCompany = await prisma.partnerCompany.findUnique({
        where: { id: childCompanyId },
        select: { referralCode: true, name: true }
      });

      if (!parentCompany || !childCompany) {
        throw new Error('Parent or child company not found');
      }

      // Get all active offers from parent
      const parentOffers = await prisma.partnerOffer.findMany({
        where: { 
          partnerCompanyId: parentCompanyId,
          isActive: true,
          isInherited: false // Solo offerte originali, non altre ereditate
        },
        include: {
          course: true
        }
      });

      let inheritedCount = 0;

      for (const parentOffer of parentOffers) {
        // Check if inherited offer already exists
        const existingInherited = await prisma.partnerOffer.findFirst({
          where: {
            partnerCompanyId: childCompanyId,
            parentOfferId: parentOffer.id
          }
        });

        if (!existingInherited) {
          // Generate unique referral link for child in format: PARENT-CHILD-TYPE-HASH
          const referralLink = this.generateSubPartnerReferralLink(
            parentCompany.referralCode,
            childCompany.referralCode,
            parentOffer.offerType
          );
          
          // Generated unique referral link for child company

          // Create inherited offer
          await prisma.partnerOffer.create({
            data: {
              partnerId: parentOffer.partnerId, // Keep same legacy partnerId for compatibility
              partnerCompanyId: childCompanyId,
              courseId: parentOffer.courseId,
              name: parentOffer.name,
              offerType: parentOffer.offerType,
              totalAmount: parentOffer.totalAmount,
              installments: parentOffer.installments,
              installmentFrequency: parentOffer.installmentFrequency,
              customPaymentPlan: parentOffer.customPaymentPlan || undefined,
              referralLink: referralLink,
              isActive: true,
              isInherited: true,
              parentOfferId: parentOffer.id,
              createdByEmployeeId: parentOffer.createdByEmployeeId
            }
          });

          inheritedCount++;
          // Created inherited offer for child company
        }
      }

      // Created inherited offers for child company
      return inheritedCount;

    } catch (error) {
      // Error creating inherited offers
      throw error;
    }
  }

  /**
   * Sincronizza offerte ereditate quando parent aggiorna/crea nuove offerte
   */
  static async syncInheritedOffers(parentCompanyId: string): Promise<void> {
    try {
      // Get all child companies
      const childCompanies = await prisma.partnerCompany.findMany({
        where: { parentId: parentCompanyId },
        select: { id: true, name: true, referralCode: true }
      });

      for (const child of childCompanies) {
        await this.createInheritedOffers(parentCompanyId, child.id);
      }

      // Synced inherited offers for sub-partners
    } catch (error) {
      // Error syncing inherited offers
      throw error;
    }
  }

  /**
   * Parse referral link per identificare parent/child
   */
  static parseReferralLink(referralLink: string): {
    parentCode: string;
    childCode?: string;
    isSubPartner: boolean;
    hash: string;
  } {
    const parts = referralLink.split('-');
    const offerTypes = ['TFA', 'CERTIFICATION', 'TFA_ROMANIA'];
    
    // Find where the offer type appears in the parts array
    let typeIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (offerTypes.includes(parts[i])) {
        typeIndex = i;
        break;
      }
    }
    
    if (typeIndex >= 2) {
      // Sub-partner format: PARENT-CHILD_PART1-CHILD_PART2-...-TYPE-HASH
      // Child code is everything between parent and type
      const parentCode = parts[0];
      const childCodeParts = parts.slice(1, typeIndex);
      const childCode = childCodeParts.join('-');
      const hash = parts.slice(typeIndex + 1).join('-');
      
      // Parsed sub-partner referral
      return {
        parentCode: parentCode,
        childCode: childCode,
        isSubPartner: true,
        hash: hash
      };
    } else if (typeIndex === 1) {
      // Parent direct format: PARENT-TYPE-HASH
      return {
        parentCode: parts[0],
        isSubPartner: false,
        hash: parts.slice(2).join('-')
      };
    } else if (parts.length >= 3) {
      // Fallback: assume PARENT-CHILD-HASH format (no explicit type)
      return {
        parentCode: parts[0],
        childCode: parts[1],
        isSubPartner: true,
        hash: parts.slice(2).join('-')
      };
    } else if (parts.length === 2) {
      // Format: PARENT-HASH (parent diretto)
      return {
        parentCode: parts[0],
        isSubPartner: false,
        hash: parts[1]
      };
    } else {
      // Formato non riconosciuto, assume parent diretto
      return {
        parentCode: parts[0] || referralLink,
        isSubPartner: false,
        hash: parts.slice(1).join('-') || ''
      };
    }
  }

  /**
   * Find companies by referral link parsing
   */
  static async findCompaniesByReferralLink(referralLink: string): Promise<{
    parentCompany: any;
    childCompany?: any;
    isSubPartnerRegistration: boolean;
  }> {
    const parsed = this.parseReferralLink(referralLink);

    // Find parent company
    const parentCompany = await prisma.partnerCompany.findFirst({
      where: { referralCode: parsed.parentCode }
    });

    if (!parentCompany) {
      throw new Error(`Parent company not found for code: ${parsed.parentCode}`);
    }

    if (parsed.isSubPartner && parsed.childCode) {
      // Find child company
      const childCompany = await prisma.partnerCompany.findFirst({
        where: { 
          referralCode: parsed.childCode,
          parentId: parentCompany.id // Ensure it's actually a child of this parent
        }
      });

      if (!childCompany) {
        // Child company not found, treating as direct registration
        return {
          parentCompany,
          isSubPartnerRegistration: false
        };
      }

      return {
        parentCompany,
        childCompany,
        isSubPartnerRegistration: true
      };
    }

    return {
      parentCompany,
      isSubPartnerRegistration: false
    };
  }
}