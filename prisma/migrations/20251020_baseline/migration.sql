-- CreateTable
CREATE TABLE "Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "contact" TEXT,
    "carNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT,
    "spaceId" TEXT,
    "numberSort" INTEGER,
    "roomType" TEXT
);

-- CreateTable
CREATE TABLE "DailyGuest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER,
    "roomType" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "carNo" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyGuest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "ts" DATETIME NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "dateKey" TEXT NOT NULL,
    "guestId" INTEGER,
    CONSTRAINT "Event_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "DailyGuest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin'
);

-- CreateTable
CREATE TABLE "AdminLoginAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLoginAudit_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceControlLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "guestId" INTEGER,
    "roomNumber" TEXT NOT NULL,
    "controlType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "actorName" TEXT,
    CONSTRAINT "DeviceControlLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomChangeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomChangeLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "refKey" TEXT NOT NULL,
    "messageKey" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "subject" TEXT,
    "fromNumber" TEXT,
    "senderProfile" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "guestToken" TEXT
);

-- CreateTable
CREATE TABLE "SmsTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "smsMessageId" INTEGER NOT NULL,
    "to" TEXT NOT NULL,
    "name" TEXT,
    "var1" TEXT,
    "var2" TEXT,
    "var3" TEXT,
    "var4" TEXT,
    "var5" TEXT,
    "var6" TEXT,
    "var7" TEXT,
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsTarget_smsMessageId_fkey" FOREIGN KEY ("smsMessageId") REFERENCES "SmsMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsOptOut" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "to" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT,
    "templateCode" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParkingLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guestId" INTEGER,
    "roomId" INTEGER,
    "roomNumber" TEXT,
    "guestName" TEXT,
    "carNo" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "humaxStatus" INTEGER,
    "humaxSyncedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAccessLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminRequestLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "path" TEXT,
    "who" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminBannedIP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "until" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGuest_token_key" ON "DailyGuest"("token");

-- CreateIndex
CREATE INDEX "Event_dateKey_idx" ON "Event"("dateKey");

-- CreateIndex
CREATE INDEX "Event_guestId_idx" ON "Event"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "DeviceControlLog_roomId_idx" ON "DeviceControlLog"("roomId");

-- CreateIndex
CREATE INDEX "DeviceControlLog_guestId_idx" ON "DeviceControlLog"("guestId");

-- CreateIndex
CREATE INDEX "RoomChangeLog_roomId_idx" ON "RoomChangeLog"("roomId");

-- CreateIndex
CREATE INDEX "SmsMessage_messageKey_idx" ON "SmsMessage"("messageKey");

-- CreateIndex
CREATE INDEX "SmsMessage_refKey_idx" ON "SmsMessage"("refKey");

-- CreateIndex
CREATE INDEX "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SmsTarget_smsMessageId_idx" ON "SmsTarget"("smsMessageId");

-- CreateIndex
CREATE INDEX "SmsTarget_to_idx" ON "SmsTarget"("to");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOptOut_to_key" ON "SmsOptOut"("to");

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_kind_key" ON "SmsTemplate"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminRequestLog_createdAt_idx" ON "AdminRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminRequestLog_ip_idx" ON "AdminRequestLog"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "AdminBannedIP_ip_key" ON "AdminBannedIP"("ip");

