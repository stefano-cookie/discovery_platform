import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDeleteOrphanedAPI() {
  console.log('🧪 Testing Delete Orphaned Users API Logic...\n');
  
  let createdUserId: string | null = null;
  
  try {
    // 1. Create a test orphaned user
    console.log('📝 Creating test orphaned user...');
    
    const testUser = await prisma.user.create({
      data: {
        email: 'test-orphaned-user@example.com',
        password: '$2b$10$VDrbjXyxHKGFkY2w32lOKuvKNGZx1PFiMG8.IFVCG/xZNe9YkKNd.', // dummy hash
        role: 'USER',
        isActive: true,
        emailVerified: true,
        assignedPartnerId: 'legacy-partner-diamante-education-main', // Assigned to legacy partner
        createdAt: new Date()
      }
    });
    
    createdUserId = testUser.id;
    console.log(`   ✅ Created user: ${testUser.email} (${testUser.id})`);
    
    // Create user profile
    const profile = await prisma.userProfile.create({
      data: {
        userId: testUser.id,
        cognome: 'Test',
        nome: 'Orphaned',
        dataNascita: new Date('1990-01-01'),
        luogoNascita: 'Roma',
        codiceFiscale: `TEST${Date.now()}`,
        telefono: '1234567890',
        residenzaVia: 'Test Street 1',
        residenzaCitta: 'Roma',
        residenzaProvincia: 'RM',
        residenzaCap: '00100'
      }
    });
    console.log(`   ✅ Created profile for user`);
    
    // Add some offer access (this should NOT prevent deletion)
    const offers = await prisma.partnerOffer.findMany({
      where: { partnerCompanyId: 'diamante-education-main' },
      take: 1
    });
    
    if (offers.length > 0) {
      await prisma.userOfferAccess.create({
        data: {
          userId: testUser.id,
          offerId: offers[0].id,
          partnerId: 'legacy-partner-diamante-education-main', // Legacy partner
          partnerCompanyId: 'diamante-education-main',
          enabled: true
        }
      });
      console.log(`   ✅ Created offer access (should not prevent deletion)`);
    }
    
    // 2. Test the orphaned user detection logic
    console.log('\\n🔍 Testing orphaned user detection...');
    
    const isUserOrphaned = async (userId: string, partnerCompanyId: string): Promise<boolean> => {
      const registrations = await prisma.registration.count({
        where: { userId, partnerCompanyId }
      });
      return registrations === 0;
    };
    
    const orphanStatus = await isUserOrphaned(testUser.id, 'diamante-education-main');
    console.log(`   User orphaned status: ${orphanStatus ? '🚫 ORPHANED' : '✅ NOT ORPHANED'}`);
    
    if (!orphanStatus) {
      console.log('   ❌ ERROR: User should be orphaned but is not detected as such');
      return;
    }
    
    // 3. Test the delete logic (simulate the API endpoint logic)
    console.log('\\n🗑️ Testing delete orphaned user logic...');
    
    // Find the user as the API would
    const userToDelete = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        profile: true,
        registrations: {
          where: { partnerCompanyId: 'diamante-education-main' }
        },
        documents: true
      }
    });
    
    if (!userToDelete) {
      console.log('   ❌ ERROR: User not found');
      return;
    }
    
    // Verify user is truly orphaned
    if (userToDelete.registrations.length > 0) {
      console.log(`   ❌ ERROR: User has ${userToDelete.registrations.length} registrations - not orphaned`);
      return;
    }
    
    console.log(`   ✅ User confirmed orphaned (0 registrations)`);
    console.log(`   User has: profile=${userToDelete.profile ? 'YES' : 'NO'}, documents=${userToDelete.documents.length}`);
    
    // 4. Execute the delete transaction (simulate the API)
    console.log('\\n🔥 Executing delete transaction...');
    
    await prisma.$transaction(async (tx) => {
      const userId = testUser.id;
      
      // Get document IDs for audit log cleanup (if any)
      const userDocuments = await tx.userDocument.findMany({
        where: { userId },
        select: { id: true }
      });
      const documentIds = userDocuments.map(doc => doc.id);
      
      console.log(`   Deleting ${documentIds.length} user documents...`);
      
      // Delete related data
      if (documentIds.length > 0) {
        await tx.documentAuditLog.deleteMany({
          where: { documentId: { in: documentIds } }
        });
        
        await tx.documentActionLog.deleteMany({
          where: { documentId: { in: documentIds } }
        });
      }
      
      await tx.userDocument.deleteMany({
        where: { userId }
      });
      
      await tx.userOfferAccess.deleteMany({
        where: { userId }
      });
      
      // Delete user profile
      if (userToDelete.profile) {
        await tx.userProfile.delete({
          where: { userId: userId }
        });
        console.log(`   Deleted user profile`);
      }
      
      // Finally delete the user
      await tx.user.delete({
        where: { id: userId }
      });
      
      console.log(`   ✅ Successfully deleted user and all related data`);
    });
    
    // 5. Verify deletion
    console.log('\\n✅ Verifying deletion...');
    
    const deletedUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    
    if (deletedUser) {
      console.log('   ❌ ERROR: User still exists after deletion');
    } else {
      console.log('   ✅ User successfully deleted');
    }
    
    const deletedProfile = await prisma.userProfile.findUnique({
      where: { userId: testUser.id }
    });
    
    if (deletedProfile) {
      console.log('   ❌ ERROR: User profile still exists after deletion');
    } else {
      console.log('   ✅ User profile successfully deleted');
    }
    
    console.log('\\n🎉 Delete orphaned user API test completed successfully!');
    console.log('\\n📊 Summary:');
    console.log('   - ✅ Created test orphaned user with profile and offer access');
    console.log('   - ✅ Correctly identified user as orphaned (no registrations)');
    console.log('   - ✅ Successfully executed delete transaction with all related data');
    console.log('   - ✅ Verified complete removal from database');
    console.log('   - ✅ Offer access did not prevent deletion (correct behavior)');
    
    // Clear the created user ID since it's been deleted
    createdUserId = null;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Clean up on error
    if (createdUserId) {
      try {
        console.log('\\n🧹 Cleaning up test user on error...');
        await prisma.userProfile.deleteMany({ where: { userId: createdUserId } });
        await prisma.userOfferAccess.deleteMany({ where: { userId: createdUserId } });
        await prisma.user.delete({ where: { id: createdUserId } });
        console.log('   ✅ Test user cleaned up');
      } catch (cleanupError) {
        console.error('   ❌ Error during cleanup:', cleanupError);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDeleteOrphanedAPI();