-- Script di seed per PRODUZIONE
-- Da eseguire DOPO la migration

-- 1. Verifica se esiste già un admin
DO $$
DECLARE
  v_admin_count INTEGER;
  v_admin_id TEXT;
  v_company_count INTEGER;
  v_company_id TEXT;
  v_tfa_course_id TEXT;
  v_cert_course_id TEXT;
BEGIN
  -- Check admin exists
  SELECT COUNT(*), MAX(id) INTO v_admin_count, v_admin_id
  FROM "User" WHERE role = 'ADMIN';

  IF v_admin_count = 0 THEN
    -- Create admin if not exists
    INSERT INTO "User" (id, email, password, role, "isActive", "emailVerified", "createdAt")
    VALUES (
      gen_random_uuid(),
      'admin@discovery.com',
      '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- admin123
      'ADMIN',
      true,
      true,
      NOW()
    )
    RETURNING id INTO v_admin_id;
    RAISE NOTICE 'Admin user created';
  ELSE
    RAISE NOTICE 'Admin user already exists';
  END IF;

  -- Check if PartnerCompany exists
  SELECT COUNT(*), MAX(id) INTO v_company_count, v_company_id
  FROM "PartnerCompany";

  IF v_company_count = 0 THEN
    -- Create default company
    INSERT INTO "PartnerCompany" (id, name, "referralCode", "canCreateChildren", "isActive", "isPremium", "commissionPerUser", "totalEarnings", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'Diamante',
      'DIAMANTE01',
      true,
      true,
      true,
      100,
      0,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_company_id;
    RAISE NOTICE 'PartnerCompany Diamante created';
  ELSE
    RAISE NOTICE 'PartnerCompany already exists, using: %', v_company_id;
  END IF;

  -- Create courses if not exist
  INSERT INTO "Course" (id, name, description, "templateType", "isActive", "createdAt")
  VALUES
    ('tfa-course-001', 'TFA Romania Sostegno', 'Corso di specializzazione per il sostegno didattico', 'TFA', true, NOW()),
    ('cert-course-001', 'Certificazioni Informatiche', 'Certificazioni informatiche riconosciute MIUR', 'CERTIFICATION', true, NOW())
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_tfa_course_id FROM "Course" WHERE "templateType" = 'TFA' LIMIT 1;
  SELECT id INTO v_cert_course_id FROM "Course" WHERE "templateType" = 'CERTIFICATION' LIMIT 1;

  RAISE NOTICE 'Courses verified - TFA: %, CERT: %', v_tfa_course_id, v_cert_course_id;

  -- Create templates (NEW SYSTEM - only partnerCompanyId)
  INSERT INTO "PartnerOffer" (
    id,
    "partnerCompanyId",
    "courseId",
    name,
    "offerType",
    "totalAmount",
    installments,
    "installmentFrequency",
    "customPaymentPlan",
    "referralLink",
    "isActive",
    "createdAt"
  ) VALUES
    (
      'tfa-template-1500',
      v_company_id,
      v_tfa_course_id,
      'Template TFA - Acconto 1500€',
      'TFA_ROMANIA',
      5000,
      10,
      1,
      '{"deposit": 1500, "installmentAmount": 350, "description": "Acconto 1500€ + 10 rate da 350€"}',
      'tfa-1500-tmpl',
      true,
      NOW()
    ),
    (
      'cert-template-standard',
      v_company_id,
      v_cert_course_id,
      'Template Certificazioni',
      'CERTIFICATION',
      3000,
      6,
      1,
      '{"deposit": 500, "installmentAmount": 416.67, "description": "Acconto 500€ + 6 rate da 416.67€"}',
      'cert-std-tmpl',
      true,
      NOW()
    )
  ON CONFLICT (id) DO UPDATE SET
    "customPaymentPlan" = EXCLUDED."customPaymentPlan",
    name = EXCLUDED.name;

  RAISE NOTICE 'Templates created/updated successfully';

  -- Final verification
  RAISE NOTICE '=== SEED COMPLETED ===';
  RAISE NOTICE 'Admin ID: %', v_admin_id;
  RAISE NOTICE 'Company ID: %', v_company_id;
  RAISE NOTICE 'TFA Course: %', v_tfa_course_id;
  RAISE NOTICE 'CERT Course: %', v_cert_course_id;
END $$;

-- Verify results
SELECT 'Admin Users' as type, COUNT(*) as count FROM "User" WHERE role = 'ADMIN'
UNION ALL
SELECT 'Partner Companies', COUNT(*) FROM "PartnerCompany"
UNION ALL
SELECT 'Courses', COUNT(*) FROM "Course"
UNION ALL
SELECT 'Templates', COUNT(*) FROM "PartnerOffer" WHERE id IN ('tfa-template-1500', 'cert-template-standard');

-- Show templates
SELECT id, name, "offerType", "partnerId", "partnerCompanyId"
FROM "PartnerOffer"
WHERE id IN ('tfa-template-1500', 'cert-template-standard');

SELECT '✅ Production seed completed successfully!' as status;
