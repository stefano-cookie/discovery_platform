import { PrismaClient } from '@prisma/client';
import emailService from '../services/emailService';
import cron from 'node-cron';

const prisma = new PrismaClient();

const REMINDER_DAYS_BEFORE_EXPIRY = [2]; // Send reminders at these intervals (2 days before expiry)

/**
 * Check all users and send password expiry reminders
 */
async function checkAndSendPasswordExpiryReminders() {
  console.log('🔍 Starting password expiry check job...');

  const now = new Date();
  const remindersToSend: Array<{
    email: string;
    role: string;
    daysUntilExpiry: number;
    userId: string;
    userType: 'User' | 'PartnerEmployee';
  }> = [];

  try {
    // Check Users (USER and ADMIN roles)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        passwordExpiresAt: {
          not: null
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        passwordExpiresAt: true,
        passwordExpiryReminderSentAt: true
      }
    });

    for (const user of users) {
      if (!user.passwordExpiresAt) continue;

      const timeDiff = user.passwordExpiresAt.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      // Check if we should send a reminder
      // Send at 2 days before OR if already expired (0 or negative days)
      const shouldCheckThisUser = REMINDER_DAYS_BEFORE_EXPIRY.includes(daysUntilExpiry) || daysUntilExpiry <= 0;

      if (shouldCheckThisUser) {
        // Check if reminder was already sent recently (within last 24 hours for expired, 12 hours for warning)
        const reminderCooldown = daysUntilExpiry <= 0 ? (24 * 60 * 60 * 1000) : (12 * 60 * 60 * 1000);
        const shouldSendReminder = !user.passwordExpiryReminderSentAt ||
          (now.getTime() - user.passwordExpiryReminderSentAt.getTime()) > reminderCooldown;

        if (shouldSendReminder) {
          remindersToSend.push({
            email: user.email,
            role: user.role,
            daysUntilExpiry: Math.max(0, daysUntilExpiry), // Clamp to 0 for expired
            userId: user.id,
            userType: 'User'
          });
        }
      }
    }

    // Check PartnerEmployees
    const employees = await prisma.partnerEmployee.findMany({
      where: {
        isActive: true,
        passwordExpiresAt: {
          not: null
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        passwordExpiresAt: true,
        passwordExpiryReminderSentAt: true
      }
    });

    for (const employee of employees) {
      if (!employee.passwordExpiresAt) continue;

      const timeDiff = employee.passwordExpiresAt.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      // Check if we should send a reminder
      // Send at 2 days before OR if already expired (0 or negative days)
      const shouldCheckThisEmployee = REMINDER_DAYS_BEFORE_EXPIRY.includes(daysUntilExpiry) || daysUntilExpiry <= 0;

      if (shouldCheckThisEmployee) {
        // Check if reminder was already sent recently (within last 24 hours for expired, 12 hours for warning)
        const reminderCooldown = daysUntilExpiry <= 0 ? (24 * 60 * 60 * 1000) : (12 * 60 * 60 * 1000);
        const shouldSendReminder = !employee.passwordExpiryReminderSentAt ||
          (now.getTime() - employee.passwordExpiryReminderSentAt.getTime()) > reminderCooldown;

        if (shouldSendReminder) {
          remindersToSend.push({
            email: employee.email,
            role: 'PARTNER',
            daysUntilExpiry: Math.max(0, daysUntilExpiry), // Clamp to 0 for expired
            userId: employee.id,
            userType: 'PartnerEmployee'
          });
        }
      }
    }

    console.log(`📧 Sending ${remindersToSend.length} password expiry reminders...`);

    // Send reminders
    for (const reminder of remindersToSend) {
      try {
        await emailService.sendPasswordExpiryReminder(
          reminder.email,
          reminder.role,
          reminder.daysUntilExpiry
        );

        // Update reminder sent timestamp
        if (reminder.userType === 'User') {
          await prisma.user.update({
            where: { id: reminder.userId },
            data: { passwordExpiryReminderSentAt: now }
          });
        } else {
          await prisma.partnerEmployee.update({
            where: { id: reminder.userId },
            data: { passwordExpiryReminderSentAt: now }
          });
        }

        console.log(`✅ Reminder sent to ${reminder.email} (${reminder.daysUntilExpiry} days)`);

      } catch (error) {
        console.error(`❌ Failed to send reminder to ${reminder.email}:`, error);
      }
    }

    console.log('✅ Password expiry check job completed successfully');

  } catch (error) {
    console.error('❌ Error in password expiry check job:', error);
  }
}

/**
 * Set password expiration date for users/employees without one
 * Run this once to backfill existing accounts
 */
async function backfillPasswordExpiration() {
  console.log('🔄 Backfilling password expiration dates...');

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 90);

  try {
    // Backfill Users
    const usersUpdated = await prisma.user.updateMany({
      where: {
        passwordExpiresAt: null,
        isActive: true
      },
      data: {
        passwordChangedAt: new Date(),
        passwordExpiresAt: expiryDate
      }
    });

    console.log(`✅ Updated ${usersUpdated.count} users with password expiration`);

    // Backfill PartnerEmployees
    const employeesUpdated = await prisma.partnerEmployee.updateMany({
      where: {
        passwordExpiresAt: null,
        isActive: true
      },
      data: {
        passwordChangedAt: new Date(),
        passwordExpiresAt: expiryDate
      }
    });

    console.log(`✅ Updated ${employeesUpdated.count} partner employees with password expiration`);

  } catch (error) {
    console.error('❌ Error backfilling password expiration:', error);
  }
}

/**
 * Schedule the password expiry check job
 * Runs every day at 9:00 AM
 */
export function startPasswordExpiryCheckJob() {
  console.log('🚀 Starting password expiry check scheduler...');

  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    await checkAndSendPasswordExpiryReminders();
  });

  console.log('✅ Password expiry check scheduler started (runs daily at 9:00 AM)');

  // Also run immediately on startup (optional, for testing)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Running initial password expiry check (development mode)...');
    setTimeout(checkAndSendPasswordExpiryReminders, 5000); // Run after 5 seconds
  }
}

// Export functions for manual execution
export { checkAndSendPasswordExpiryReminders, backfillPasswordExpiration };
