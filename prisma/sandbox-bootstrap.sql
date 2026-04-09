-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('DI', 'GA');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PENDING_STAFF_REVIEW', 'PENDING_TRUCKER_FINALIZATION', 'FILED', 'AMENDED');

-- CreateEnum
CREATE TYPE "Quarter" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "UCRFilingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUESTED', 'RESUBMITTED', 'PENDING_PROOF', 'APPROVED', 'COMPLIANT', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UCREntityType" AS ENUM ('MOTOR_CARRIER', 'BROKER', 'FREIGHT_FORWARDER', 'LEASING_COMPANY');

-- CreateEnum
CREATE TYPE "UCRDocumentType" AS ENUM ('REGISTRATION_PROOF', 'PAYMENT_RECEIPT', 'SUPPORTING_DOCUMENT', 'CORRECTION_ATTACHMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "Form2290Status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CORRECTION', 'SUBMITTED', 'PAID', 'COMPLIANT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Form2290PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "Form2290DocumentType" AS ENUM ('SUPPORTING_DOC', 'SCHEDULE_1', 'PAYMENT_PROOF');

-- CreateEnum
CREATE TYPE "TruckVehicleType" AS ENUM ('TRACTOR', 'STRAIGHT_TRUCK', 'SEMI_TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "TruckOperationType" AS ENUM ('INTRASTATE', 'INTERSTATE');

-- CreateEnum
CREATE TYPE "DmvRegistrationType" AS ENUM ('NEVADA_ONLY', 'IRP');

-- CreateEnum
CREATE TYPE "DmvFilingType" AS ENUM ('INITIAL', 'RENEWAL');

-- CreateEnum
CREATE TYPE "DmvRegistrationStatus" AS ENUM ('DRAFT', 'WAITING_CLIENT_DOCS', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'READY_FOR_FILING', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'EXPIRED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DmvRenewalStatus" AS ENUM ('NOT_OPEN', 'OPEN', 'WAITING_CLIENT_DOCS', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'READY_FOR_FILING', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "DmvRequirementStatus" AS ENUM ('MISSING', 'UPLOADED', 'APPROVED', 'REJECTED', 'WAIVED');

-- CreateEnum
CREATE TYPE "DmvDocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DmvMileageSource" AS ENUM ('MANUAL', 'IMPORT', 'ELD', 'PRIOR_JURISDICTION');

-- CreateEnum
CREATE TYPE "DmvActorType" AS ENUM ('SYSTEM', 'CLIENT', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SYSTEM', 'DMV', 'IFTA', 'UCR', 'FORM2290', 'DOCUMENTS', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "owner" TEXT,
    "legalName" TEXT,
    "dbaName" TEXT,
    "dotNumber" TEXT,
    "mcNumber" TEXT,
    "ein" TEXT,
    "businessPhone" TEXT,
    "address" TEXT,
    "state" TEXT,
    "trucksCount" INTEGER,
    "driversCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "providerPaymentMethodId" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "paypalEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "nickname" TEXT,
    "plateNumber" TEXT,
    "statePlate" TEXT,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "grossWeight" INTEGER,
    "axleCount" INTEGER,
    "vehicleType" "TruckVehicleType",
    "operationType" "TruckOperationType" NOT NULL DEFAULT 'INTRASTATE',
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "is2290Eligible" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT,
    "isIftaMember" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaTaxRate" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "taxRate" DECIMAL(10,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT,
    "sourceQuarterKey" TEXT,
    "sourceFileUrl" TEXT,
    "importedAt" TIMESTAMP(3),
    "importedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaTaxRateImportRun" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "insertedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedById" TEXT,

    CONSTRAINT "IftaTaxRateImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "truckId" TEXT,
    "year" INTEGER NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "fuelType" "FuelType" NOT NULL DEFAULT 'DI',
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "totalMiles" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGallons" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "averageMpg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTaxDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "filedAt" TIMESTAMP(3),
    "submittedForReviewAt" TIMESTAMP(3),
    "staffReviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaReportLine" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL DEFAULT 'DI',
    "taxRate" DECIMAL(10,4) NOT NULL,
    "miles" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidGallons" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableMiles" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableGallons" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netTaxableGallons" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaReportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "truckId" TEXT,
    "reportId" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "totalMiles" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripMileage" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "miles" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripMileage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "truckId" TEXT,
    "reportId" TEXT,
    "jurisdictionId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "fuelType" "FuelType" NOT NULL DEFAULT 'DI',
    "gallons" DECIMAL(12,2) NOT NULL,
    "pricePerGallon" DECIMAL(10,4),
    "totalAmount" DECIMAL(12,2),
    "vendor" TEXT,
    "receiptNumber" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCRRateBracket" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "minVehicles" INTEGER NOT NULL,
    "maxVehicles" INTEGER NOT NULL,
    "feeAmount" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UCRRateBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCRFiling" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filingYear" INTEGER NOT NULL,
    "legalName" TEXT NOT NULL,
    "usdotNumber" TEXT,
    "mcNumber" TEXT,
    "fein" TEXT,
    "baseState" TEXT,
    "entityType" "UCREntityType" NOT NULL,
    "interstateOperation" BOOLEAN NOT NULL DEFAULT true,
    "fleetSize" INTEGER NOT NULL,
    "bracketLabel" TEXT,
    "feeAmount" DECIMAL(10,2) NOT NULL,
    "status" "UCRFilingStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "correctionRequestedAt" TIMESTAMP(3),
    "resubmittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "compliantAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "clientNotes" TEXT,
    "staffNotes" TEXT,
    "correctionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UCRFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCRDocument" (
    "id" TEXT NOT NULL,
    "ucrFilingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "type" "UCRDocumentType" NOT NULL DEFAULT 'OTHER',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UCRDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2290Setting" (
    "id" TEXT NOT NULL,
    "minimumEligibleWeight" INTEGER NOT NULL DEFAULT 55000,
    "expirationWarningDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form2290Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2290TaxPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "filingDeadline" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form2290TaxPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2290Filing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "status" "Form2290Status" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "Form2290PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "vinSnapshot" TEXT NOT NULL,
    "unitNumberSnapshot" TEXT,
    "grossWeightSnapshot" INTEGER,
    "firstUsedMonth" INTEGER,
    "firstUsedYear" INTEGER,
    "amountDue" DECIMAL(10,2),
    "filedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "compliantAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "schedule1DocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form2290Filing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2290Correction" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form2290Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2290Document" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "Form2290DocumentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form2290Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2290ActivityLog" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form2290ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "registrationType" "DmvRegistrationType" NOT NULL,
    "filingType" "DmvFilingType" NOT NULL DEFAULT 'INITIAL',
    "status" "DmvRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "dmvAccountNumber" TEXT,
    "fleetNumber" TEXT,
    "cabCardNumber" TEXT,
    "plateNumber" TEXT,
    "jurisdictionBase" TEXT DEFAULT 'NV',
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "registrationMonth" INTEGER,
    "declaredGrossWeight" INTEGER,
    "apportioned" BOOLEAN NOT NULL DEFAULT false,
    "establishedBusinessOk" BOOLEAN,
    "carrierRelocated" BOOLEAN NOT NULL DEFAULT false,
    "dotNumber" TEXT,
    "mcNumber" TEXT,
    "fein" TEXT,
    "nevadaAddress" TEXT,
    "lastSubmittedAt" TIMESTAMP(3),
    "lastApprovedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmvRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRenewal" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "status" "DmvRenewalStatus" NOT NULL DEFAULT 'NOT_OPEN',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "internalNotes" TEXT,
    "clientNotes" TEXT,
    "correctionReason" TEXT,
    "mileageSource" "DmvMileageSource",
    "totalMiles" INTEGER,
    "nvMiles" INTEGER,
    "mileageDataJson" JSONB,
    "feeEstimateJson" JSONB,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmvRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRegistrationJurisdiction" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "jurisdictionId" TEXT,
    "jurisdictionCode" TEXT NOT NULL,
    "declaredWeight" INTEGER,
    "estimatedMiles" INTEGER,
    "actualMiles" INTEGER,

    CONSTRAINT "DmvRegistrationJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRequirementTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesToType" "DmvRegistrationType",
    "appliesToRenewal" BOOLEAN NOT NULL DEFAULT true,
    "appliesToInitial" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmvRequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRequirementSnapshot" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "renewalId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "status" "DmvRequirementStatus" NOT NULL DEFAULT 'MISSING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmvRequirementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRegistrationDocument" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "requirementCode" TEXT,
    "documentId" TEXT NOT NULL,
    "status" "DmvDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmvRegistrationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRenewalDocument" (
    "id" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "requirementCode" TEXT,
    "documentId" TEXT NOT NULL,
    "status" "DmvDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmvRenewalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvActivity" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT,
    "renewalId" TEXT,
    "actorUserId" TEXT,
    "actorType" "DmvActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "message" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmvActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "level" "NotificationLevel" NOT NULL DEFAULT 'INFO',
    "href" TEXT,
    "actionLabel" TEXT,
    "readAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvFeeRule" (
    "id" TEXT NOT NULL,
    "registrationType" "DmvRegistrationType",
    "jurisdictionCode" TEXT,
    "vehicleType" "TruckVehicleType",
    "minWeight" INTEGER,
    "maxWeight" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmvFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxScenario" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandboxScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxAuditLog" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actingAsUserId" TEXT,
    "actingAsRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxImpersonationSession" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actingAsUserId" TEXT,
    "actingAsRole" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandboxImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_userId_key" ON "CompanyProfile"("userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_provider_idx" ON "PaymentMethod"("userId", "provider");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_vin_key" ON "Truck"("vin");

-- CreateIndex
CREATE INDEX "Truck_userId_idx" ON "Truck"("userId");

-- CreateIndex
CREATE INDEX "Truck_vin_idx" ON "Truck"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_code_key" ON "Jurisdiction"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_name_key" ON "Jurisdiction"("name");

-- CreateIndex
CREATE INDEX "IftaTaxRate_year_quarter_idx" ON "IftaTaxRate"("year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "IftaTaxRate_jurisdictionId_year_quarter_fuelType_key" ON "IftaTaxRate"("jurisdictionId", "year", "quarter", "fuelType");

-- CreateIndex
CREATE INDEX "IftaTaxRateImportRun_year_quarter_executedAt_idx" ON "IftaTaxRateImportRun"("year", "quarter", "executedAt");

-- CreateIndex
CREATE INDEX "IftaReport_userId_year_quarter_idx" ON "IftaReport"("userId", "year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "IftaReport_userId_truckId_year_quarter_fuelType_key" ON "IftaReport"("userId", "truckId", "year", "quarter", "fuelType");

-- CreateIndex
CREATE UNIQUE INDEX "IftaReportLine_reportId_jurisdictionId_fuelType_key" ON "IftaReportLine"("reportId", "jurisdictionId", "fuelType");

-- CreateIndex
CREATE INDEX "Trip_userId_tripDate_idx" ON "Trip"("userId", "tripDate");

-- CreateIndex
CREATE INDEX "Trip_reportId_idx" ON "Trip"("reportId");

-- CreateIndex
CREATE INDEX "TripMileage_jurisdictionId_idx" ON "TripMileage"("jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "TripMileage_tripId_jurisdictionId_key" ON "TripMileage"("tripId", "jurisdictionId");

-- CreateIndex
CREATE INDEX "FuelPurchase_userId_purchaseDate_idx" ON "FuelPurchase"("userId", "purchaseDate");

-- CreateIndex
CREATE INDEX "FuelPurchase_reportId_idx" ON "FuelPurchase"("reportId");

-- CreateIndex
CREATE INDEX "FuelPurchase_jurisdictionId_idx" ON "FuelPurchase"("jurisdictionId");

-- CreateIndex
CREATE INDEX "UCRRateBracket_year_active_idx" ON "UCRRateBracket"("year", "active");

-- CreateIndex
CREATE UNIQUE INDEX "UCRRateBracket_year_minVehicles_maxVehicles_key" ON "UCRRateBracket"("year", "minVehicles", "maxVehicles");

-- CreateIndex
CREATE INDEX "UCRFiling_userId_filingYear_idx" ON "UCRFiling"("userId", "filingYear");

-- CreateIndex
CREATE INDEX "UCRFiling_status_idx" ON "UCRFiling"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UCRFiling_userId_filingYear_key" ON "UCRFiling"("userId", "filingYear");

-- CreateIndex
CREATE INDEX "UCRDocument_ucrFilingId_type_idx" ON "UCRDocument"("ucrFilingId", "type");

-- CreateIndex
CREATE INDEX "Form2290TaxPeriod_startDate_endDate_idx" ON "Form2290TaxPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Form2290TaxPeriod_isActive_idx" ON "Form2290TaxPeriod"("isActive");

-- CreateIndex
CREATE INDEX "Form2290Filing_userId_idx" ON "Form2290Filing"("userId");

-- CreateIndex
CREATE INDEX "Form2290Filing_truckId_idx" ON "Form2290Filing"("truckId");

-- CreateIndex
CREATE INDEX "Form2290Filing_taxPeriodId_idx" ON "Form2290Filing"("taxPeriodId");

-- CreateIndex
CREATE INDEX "Form2290Filing_status_paymentStatus_idx" ON "Form2290Filing"("status", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Form2290Filing_truckId_taxPeriodId_key" ON "Form2290Filing"("truckId", "taxPeriodId");

-- CreateIndex
CREATE INDEX "Form2290Correction_filingId_resolved_idx" ON "Form2290Correction"("filingId", "resolved");

-- CreateIndex
CREATE INDEX "Form2290Document_filingId_idx" ON "Form2290Document"("filingId");

-- CreateIndex
CREATE INDEX "Form2290Document_documentId_idx" ON "Form2290Document"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Form2290Document_filingId_documentId_key" ON "Form2290Document"("filingId", "documentId");

-- CreateIndex
CREATE INDEX "Form2290ActivityLog_filingId_createdAt_idx" ON "Form2290ActivityLog"("filingId", "createdAt");

-- CreateIndex
CREATE INDEX "DmvRegistration_userId_idx" ON "DmvRegistration"("userId");

-- CreateIndex
CREATE INDEX "DmvRegistration_truckId_idx" ON "DmvRegistration"("truckId");

-- CreateIndex
CREATE INDEX "DmvRegistration_status_idx" ON "DmvRegistration"("status");

-- CreateIndex
CREATE INDEX "DmvRegistration_expirationDate_idx" ON "DmvRegistration"("expirationDate");

-- CreateIndex
CREATE INDEX "DmvRegistration_registrationType_idx" ON "DmvRegistration"("registrationType");

-- CreateIndex
CREATE INDEX "DmvRenewal_dueDate_idx" ON "DmvRenewal"("dueDate");

-- CreateIndex
CREATE INDEX "DmvRenewal_status_idx" ON "DmvRenewal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRenewal_registrationId_cycleYear_key" ON "DmvRenewal"("registrationId", "cycleYear");

-- CreateIndex
CREATE INDEX "DmvRegistrationJurisdiction_registrationId_idx" ON "DmvRegistrationJurisdiction"("registrationId");

-- CreateIndex
CREATE INDEX "DmvRegistrationJurisdiction_jurisdictionId_idx" ON "DmvRegistrationJurisdiction"("jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRegistrationJurisdiction_registrationId_jurisdictionCode_key" ON "DmvRegistrationJurisdiction"("registrationId", "jurisdictionCode");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRequirementTemplate_code_key" ON "DmvRequirementTemplate"("code");

-- CreateIndex
CREATE INDEX "DmvRequirementTemplate_active_sortOrder_idx" ON "DmvRequirementTemplate"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "DmvRequirementTemplate_appliesToType_idx" ON "DmvRequirementTemplate"("appliesToType");

-- CreateIndex
CREATE INDEX "DmvRequirementSnapshot_registrationId_idx" ON "DmvRequirementSnapshot"("registrationId");

-- CreateIndex
CREATE INDEX "DmvRequirementSnapshot_renewalId_idx" ON "DmvRequirementSnapshot"("renewalId");

-- CreateIndex
CREATE INDEX "DmvRequirementSnapshot_status_idx" ON "DmvRequirementSnapshot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRequirementSnapshot_registrationId_renewalId_code_key" ON "DmvRequirementSnapshot"("registrationId", "renewalId", "code");

-- CreateIndex
CREATE INDEX "DmvRegistrationDocument_registrationId_idx" ON "DmvRegistrationDocument"("registrationId");

-- CreateIndex
CREATE INDEX "DmvRegistrationDocument_documentId_idx" ON "DmvRegistrationDocument"("documentId");

-- CreateIndex
CREATE INDEX "DmvRegistrationDocument_requirementCode_idx" ON "DmvRegistrationDocument"("requirementCode");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRegistrationDocument_registrationId_documentId_key" ON "DmvRegistrationDocument"("registrationId", "documentId");

-- CreateIndex
CREATE INDEX "DmvRenewalDocument_renewalId_idx" ON "DmvRenewalDocument"("renewalId");

-- CreateIndex
CREATE INDEX "DmvRenewalDocument_documentId_idx" ON "DmvRenewalDocument"("documentId");

-- CreateIndex
CREATE INDEX "DmvRenewalDocument_requirementCode_idx" ON "DmvRenewalDocument"("requirementCode");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRenewalDocument_renewalId_documentId_key" ON "DmvRenewalDocument"("renewalId", "documentId");

-- CreateIndex
CREATE INDEX "DmvActivity_registrationId_idx" ON "DmvActivity"("registrationId");

-- CreateIndex
CREATE INDEX "DmvActivity_renewalId_idx" ON "DmvActivity"("renewalId");

-- CreateIndex
CREATE INDEX "DmvActivity_createdAt_idx" ON "DmvActivity"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt");

-- CreateIndex
CREATE INDEX "DmvFeeRule_registrationType_active_idx" ON "DmvFeeRule"("registrationType", "active");

-- CreateIndex
CREATE INDEX "DmvFeeRule_jurisdictionCode_active_idx" ON "DmvFeeRule"("jurisdictionCode", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxScenario_key_key" ON "SandboxScenario"("key");

-- CreateIndex
CREATE INDEX "SandboxAuditLog_createdAt_idx" ON "SandboxAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SandboxAuditLog_action_createdAt_idx" ON "SandboxAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "SandboxAuditLog_actorUserId_createdAt_idx" ON "SandboxAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SandboxImpersonationSession_actorUserId_isActive_idx" ON "SandboxImpersonationSession"("actorUserId", "isActive");

-- CreateIndex
CREATE INDEX "SandboxImpersonationSession_actingAsUserId_isActive_idx" ON "SandboxImpersonationSession"("actingAsUserId", "isActive");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaTaxRate" ADD CONSTRAINT "IftaTaxRate_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaReport" ADD CONSTRAINT "IftaReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaReport" ADD CONSTRAINT "IftaReport_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaReportLine" ADD CONSTRAINT "IftaReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IftaReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaReportLine" ADD CONSTRAINT "IftaReportLine_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IftaReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMileage" ADD CONSTRAINT "TripMileage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMileage" ADD CONSTRAINT "TripMileage_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPurchase" ADD CONSTRAINT "FuelPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPurchase" ADD CONSTRAINT "FuelPurchase_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPurchase" ADD CONSTRAINT "FuelPurchase_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IftaReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPurchase" ADD CONSTRAINT "FuelPurchase_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UCRFiling" ADD CONSTRAINT "UCRFiling_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UCRDocument" ADD CONSTRAINT "UCRDocument_ucrFilingId_fkey" FOREIGN KEY ("ucrFilingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Filing" ADD CONSTRAINT "Form2290Filing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Filing" ADD CONSTRAINT "Form2290Filing_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Filing" ADD CONSTRAINT "Form2290Filing_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "Form2290TaxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Filing" ADD CONSTRAINT "Form2290Filing_schedule1DocumentId_fkey" FOREIGN KEY ("schedule1DocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Correction" ADD CONSTRAINT "Form2290Correction_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Document" ADD CONSTRAINT "Form2290Document_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290Document" ADD CONSTRAINT "Form2290Document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2290ActivityLog" ADD CONSTRAINT "Form2290ActivityLog_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRegistration" ADD CONSTRAINT "DmvRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRegistration" ADD CONSTRAINT "DmvRegistration_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRenewal" ADD CONSTRAINT "DmvRenewal_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRegistrationJurisdiction" ADD CONSTRAINT "DmvRegistrationJurisdiction_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRegistrationJurisdiction" ADD CONSTRAINT "DmvRegistrationJurisdiction_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRequirementSnapshot" ADD CONSTRAINT "DmvRequirementSnapshot_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRequirementSnapshot" ADD CONSTRAINT "DmvRequirementSnapshot_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "DmvRenewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRegistrationDocument" ADD CONSTRAINT "DmvRegistrationDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRegistrationDocument" ADD CONSTRAINT "DmvRegistrationDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRenewalDocument" ADD CONSTRAINT "DmvRenewalDocument_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "DmvRenewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvRenewalDocument" ADD CONSTRAINT "DmvRenewalDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvActivity" ADD CONSTRAINT "DmvActivity_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmvActivity" ADD CONSTRAINT "DmvActivity_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "DmvRenewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
