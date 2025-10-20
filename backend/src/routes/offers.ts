import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, AuthRequest } from '../middleware/auth';
import { generateUniqueId } from '../utils/idGenerator';
import { OfferInheritanceService } from '../services/offerInheritanceService';
import { activityLogger } from '../services/activityLogger.service';

const router = express.Router();
const prisma = new PrismaClient();

// Validation functions
function validateCreateOffer(data: any) {
  const required = ['courseId', 'name', 'offerType', 'totalAmount', 'installments', 'installmentFrequency'];
  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Field ${field} is required`);
    }
  }
  
  if (!['TFA_ROMANIA', 'CERTIFICATION'].includes(data.offerType)) {
    throw new Error('Invalid offer type');
  }
  
  if (data.totalAmount <= 0 || data.installments <= 0 || data.installmentFrequency <= 0) {
    throw new Error('Amount and installment values must be positive');
  }
  
  return data;
}

// GET /api/offers - Get all offers for partner company (including inherited ones)
router.get('/', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    // Get the partner company with parent info
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      include: { parent: true }
    });

    if (!partnerCompany) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    let offers;
    
    if (partnerCompany.parentId) {
      // For sub-partners: first ensure inherited offers are up to date, then show them
      await OfferInheritanceService.createInheritedOffers(partnerCompany.parentId, partnerCompanyId);
      
      offers = await prisma.partnerOffer.findMany({
        where: {
          partnerCompanyId: partnerCompanyId, // Only inherited offers belonging to this sub-partner
          isActive: true
        },
        include: {
          course: true,
          partnerCompany: {
            select: {
              id: true,
              name: true,
              referralCode: true
            }
          },
          parentOffer: {
            include: {
              partnerCompany: {
                select: {
                  id: true,
                  name: true,
                  referralCode: true
                }
              }
            }
          },
          createdByEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { registrations: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // For parent companies: show their own offers + can access all offers in hierarchy for management
      const companyIds = [partnerCompanyId];
      let currentParent = partnerCompany.parent;
      
      while (currentParent) {
        companyIds.push(currentParent.id);
        currentParent = await prisma.partnerCompany.findUnique({
          where: { id: currentParent.id },
          include: { parent: true }
        }).then(company => company?.parent || null);
      }

      // Get offers from this company and all parents
      offers = await prisma.partnerOffer.findMany({
        where: {
          partnerCompanyId: { in: companyIds },
          isActive: true
        },
        include: {
          course: true,
          partnerCompany: {
            select: {
              id: true,
              name: true,
              referralCode: true
            }
          },
          createdByEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { registrations: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // Mark offers as inherited vs own and generate proper referral links for sub-partners
    const offersWithInheritance = offers.map(offer => {
      const isInherited = offer.partnerCompanyId !== partnerCompanyId || (offer as any).isInherited;
      let inheritedFrom = null;
      
      // For sub-partners, all offers are inherited from parent
      if (partnerCompany.parentId && (offer as any).parentOffer) {
        inheritedFrom = (offer as any).parentOffer.partnerCompany;
      } else if (isInherited) {
        inheritedFrom = offer.partnerCompany;
      }
      
      return {
        ...offer,
        referralLink: offer.referralLink, // Use the pre-generated referral link for sub-partners
        isInherited,
        inheritedFrom
      };
    });

    res.json(offersWithInheritance);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/offers/:id - Get specific offer (accessible to authenticated users)
router.get('/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerCompany = req.partnerCompany;
    
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        isActive: true
      },
      include: {
        course: true,
        partnerCompany: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        },
        partner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        createdByEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Generate appropriate referral link for sub-partner if needed
    let referralLink = offer.referralLink;
    const isInherited = offer.partnerCompanyId !== partnerCompanyId;
    
    if (isInherited && partnerCompany?.parentId && partnerCompanyId) {
      // Format: PARENT001-CHILD001-TYPE-HASH
      const parentCode = offer.partnerCompany?.referralCode || '';
      const childCode = partnerCompany.referralCode;
      const offerType = offer.offerType === 'TFA_ROMANIA' ? 'TFA' : 'CERTIFICATION';
      const hash = offer.referralLink.split('-').pop() || 'HASH';
      referralLink = `${parentCode}-${childCode}-${offerType}-${hash}`;
    }

    // Return simplified offer data for enrollment
    const simplifiedOffer = {
      id: offer.id,
      name: offer.name,
      offerType: offer.offerType,
      course: offer.course,
      totalAmount: offer.totalAmount,
      installments: offer.installments,
      referralLink: referralLink, // Use the modified referral link for sub-partners
      isInherited,
      inheritedFrom: isInherited ? offer.partnerCompany : null
    };

    res.json({ offer: simplifiedOffer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/offers - Create new offer (only for parent companies)
router.post('/', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const validatedData = validateCreateOffer(req.body);

    const partnerCompanyId = req.partnerCompany?.id;
    const partnerCompany = req.partnerCompany;

    if (!partnerCompanyId || !partnerCompany) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    // Block offer creation for child companies
    if (partnerCompany.parentId) {
      return res.status(403).json({ 
        error: 'Child companies cannot create offers. Offers are inherited from parent companies.' 
      });
    }

    // Generate unique referral link
    const referralLink = `${partnerCompany.referralCode}-${generateUniqueId(8)}`;

    // Find or create a legacy Partner record for backward compatibility
    let legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${partnerCompany.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      const dummyUserId = `dummy-user-for-partner-${partnerCompanyId}`;
      
      // Create a dummy user if it doesn't exist
      let dummyUser = await prisma.user.findUnique({
        where: { id: dummyUserId }
      });
      
      if (!dummyUser) {
        dummyUser = await prisma.user.create({
          data: {
            id: dummyUserId,
            email: `dummy-${partnerCompanyId}@legacy.system`,
            password: 'dummy-password-hash',
            role: 'PARTNER',
            isActive: false,
            emailVerified: false
          }
        });
      }
      
      // Create a legacy partner entry for backward compatibility
      legacyPartner = await prisma.partner.create({
        data: {
          id: `legacy-partner-${partnerCompanyId}`,
          userId: dummyUserId,
          referralCode: `${partnerCompany.referralCode}-LEGACY`,
          canCreateChildren: false,
          commissionPerUser: 0,
          commissionToAdmin: 0
        }
      });
    }

    const offer = await prisma.partnerOffer.create({
      data: {
        partnerId: legacyPartner.id, // For backward compatibility
        partnerCompanyId,
        courseId: validatedData.courseId,
        name: validatedData.name,
        offerType: validatedData.offerType,
        totalAmount: validatedData.totalAmount,
        installments: validatedData.installments,
        installmentFrequency: validatedData.installmentFrequency,
        customPaymentPlan: validatedData.customPaymentPlan,
        referralLink: referralLink,
        createdByEmployeeId: req.partnerEmployee?.id || null
      },
      include: {
        course: true
      }
    });

    // 📊 Activity Log: Partner created new offer
    if (req.partnerEmployee?.id && partnerCompanyId) {
      await activityLogger.logInfo(
        req.partnerEmployee.id,
        partnerCompanyId,
        'Nuova offerta creata',
        {
          resourceType: 'OFFER',
          resourceId: offer.id,
          details: {
            offerName: offer.name,
            courseName: offer.course.name,
            offerType: offer.offerType,
            totalAmount: offer.totalAmount,
            installments: offer.installments,
            referralLink: offer.referralLink
          }
        }
      );
    }

    // After creating the offer, automatically create inherited offers for all sub-partners
    try {
      await OfferInheritanceService.syncInheritedOffers(partnerCompanyId);
      console.log(`✅ Auto-synced inherited offers for new offer: ${offer.name}`);
    } catch (error) {
      console.error('Error auto-syncing inherited offers:', error);
      // Don't fail the offer creation if inheritance sync fails
    }

    res.status(201).json(offer);
  } catch (error: any) {
    if (error.message.includes('Field') || error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/offers/:id - Update offer (only for parent companies and own offers)
router.put('/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerCompany = req.partnerCompany;
    
    if (!partnerCompanyId || !partnerCompany) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerCompanyId: partnerCompanyId
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or you do not have permission to modify it' });
    }

    // Block offer modification for child companies (they can't modify even their parent's inherited offers)
    if (partnerCompany.parentId) {
      return res.status(403).json({ 
        error: 'Child companies cannot modify offers. Only parent companies can modify their offers.' 
      });
    }

    const updatedOffer = await prisma.partnerOffer.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        course: true
      }
    });

    res.json(updatedOffer);
  } catch (error: any) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/offers/:id - Delete offer (only for parent companies and own offers)
router.delete('/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerCompany = req.partnerCompany;
    
    if (!partnerCompanyId || !partnerCompany) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerCompanyId: partnerCompanyId
      },
      include: {
        course: true
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or you do not have permission to delete it' });
    }

    // Block offer deletion for child companies
    if (partnerCompany.parentId) {
      return res.status(403).json({
        error: 'Child companies cannot delete offers. Only parent companies can delete their offers.'
      });
    }

    // Check if offer has registrations
    const registrationCount = await prisma.registration.count({
      where: { partnerOfferId: req.params.id }
    });

    if (registrationCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete offer with existing registrations'
      });
    }

    await prisma.partnerOffer.delete({
      where: { id: req.params.id }
    });

    // 📊 Activity Log: Partner deleted offer
    if (req.partnerEmployee?.id && partnerCompanyId) {
      await activityLogger.logWarning(
        req.partnerEmployee.id,
        partnerCompanyId,
        'Offerta eliminata',
        {
          resourceType: 'OFFER',
          resourceId: offer.id,
          details: {
            offerName: offer.name,
            courseName: offer.course.name,
            offerType: offer.offerType,
            totalAmount: offer.totalAmount,
            referralLink: offer.referralLink
          }
        }
      );
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/offers/by-link/:referralLink - Get offer by referral link (public)
router.get('/by-link/:referralLink', async (req, res) => {
  try {
    const referralLink = req.params.referralLink;
    let offer = null;
    let sourceCompanyInfo = null;
    
    // First try to find the offer with the exact referral link
    offer = await prisma.partnerOffer.findUnique({
      where: { 
        referralLink: referralLink,
        isActive: true
      },
      include: {
        course: true,
        partnerCompany: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        },
        partner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });
    
    // Check if this is a hierarchical link by parsing the referral link intelligently
    if (offer && referralLink.includes('-') && referralLink.split('-').length >= 4) {
      // Get all partner companies to match against the referral link
      const allCompanies = await prisma.partnerCompany.findMany({
        select: { id: true, name: true, referralCode: true, parentId: true }
      });
      
      // Try to identify parent and child codes by matching existing referral codes
      let childCompany = null;
      
      // Look for the longest matching referral code at the beginning (parent)
      for (const company of allCompanies) {
        if (referralLink.startsWith(company.referralCode + '-')) {
          // Now look for child code after parent code
          const afterParent = referralLink.substring(company.referralCode.length + 1);
          
          for (const childCandidate of allCompanies) {
            if (childCandidate.parentId === company.id && afterParent.startsWith(childCandidate.referralCode + '-')) {
              childCompany = childCandidate;
              break;
            }
          }
          break;
        }
      }
      
      if (childCompany) {
        sourceCompanyInfo = {
          id: childCompany.id,
          name: childCompany.name,
          referralCode: childCompany.referralCode
        };
      }
    }

    // If not found and referral link has hierarchical format (PARENT-CHILD-TYPE-HASH)
    if (!offer && referralLink.includes('-') && referralLink.split('-').length >= 4) {
      const linkParts = referralLink.split('-');
      if (linkParts.length >= 4) {
        const parentCode = linkParts[0];
        const childCode = linkParts[1];
        const offerType = linkParts[2];
        const hash = linkParts.slice(3).join('-'); // Handle cases where hash might contain dashes
        
        // Map offer type back to database enum
        const dbOfferType = offerType === 'TFA' ? 'TFA_ROMANIA' : 'CERTIFICATION';
        
        // Find the parent company and the original offer
        const parentCompany = await prisma.partnerCompany.findUnique({
          where: { referralCode: parentCode }
        });
        
        // Find the child company to track the source
        const childCompany = await prisma.partnerCompany.findUnique({
          where: { referralCode: childCode }
        });
        
        if (parentCompany && childCompany) {
          // Find the parent's offer that ends with the same hash and matches the offer type
          offer = await prisma.partnerOffer.findFirst({
            where: {
              partnerCompanyId: parentCompany.id,
              offerType: dbOfferType,
              referralLink: { endsWith: hash },
              isActive: true
            },
            include: {
              course: true,
              partnerCompany: {
                select: {
                  id: true,
                  name: true,
                  referralCode: true
                }
              },
              partner: {
                select: {
                  referralCode: true,
                  user: {
                    select: {
                      email: true
                    }
                  }
                }
              }
            }
          });
          
          // Store child company info for tracking
          if (offer) {
            sourceCompanyInfo = {
              id: childCompany.id,
              name: childCompany.name,
              referralCode: childCompany.referralCode
            };
          }
        }
      }
    }

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Include all fields needed by the frontend, including customPaymentPlan
    const offerResponse = {
      ...offer,
      customPaymentPlan: offer.customPaymentPlan, // Ensure this field is included
      originalReferralLink: referralLink, // Keep track of the original link used
      sourceCompany: sourceCompanyInfo // Include sub-partner info if applicable
    };

    res.json(offerResponse);
  } catch (error) {
    console.error('Error fetching offer by link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;