/* Smart Todo schema. Execute while connected to the target Azure SQL database. */

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users (
    UserId uniqueidentifier NOT NULL CONSTRAINT DF_Users_Id DEFAULT NEWSEQUENTIALID(),
    Email nvarchar(254) NOT NULL,
    DisplayName nvarchar(100) NOT NULL,
    PasswordHash nvarchar(512) NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Users_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Users_Updated DEFAULT SYSUTCDATETIME(),
    Version rowversion NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT CK_Users_Email CHECK (LEN(LTRIM(RTRIM(Email))) > 0),
    CONSTRAINT CK_Users_Name CHECK (LEN(LTRIM(RTRIM(DisplayName))) > 0)
);
GO

IF OBJECT_ID(N'dbo.PasswordResetTokens', N'U') IS NULL
CREATE TABLE dbo.PasswordResetTokens (
    UserId uniqueidentifier NOT NULL,
    TokenHash char(64) NOT NULL,
    ExpiresAt datetime2(3) NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_PasswordResetTokens_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PasswordResetTokens PRIMARY KEY (UserId),
    CONSTRAINT UQ_PasswordResetTokens_TokenHash UNIQUE (TokenHash),
    CONSTRAINT FK_PasswordResetTokens_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.Projects', N'U') IS NULL
CREATE TABLE dbo.Projects (
    ProjectId uniqueidentifier NOT NULL CONSTRAINT DF_Projects_Id DEFAULT NEWSEQUENTIALID(),
    UserId uniqueidentifier NOT NULL,
    Name nvarchar(150) NOT NULL,
    Description nvarchar(2000) NULL,
    IsArchived bit NOT NULL CONSTRAINT DF_Projects_Archived DEFAULT 0,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Projects_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Projects_Updated DEFAULT SYSUTCDATETIME(),
    Version rowversion NOT NULL,
    CONSTRAINT PK_Projects PRIMARY KEY (ProjectId),
    CONSTRAINT UQ_Projects_Owner UNIQUE (UserId, ProjectId),
    CONSTRAINT FK_Projects_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Projects_Name CHECK (LEN(LTRIM(RTRIM(Name))) > 0)
);
GO

IF OBJECT_ID(N'dbo.Tasks', N'U') IS NULL
CREATE TABLE dbo.Tasks (
    TaskId uniqueidentifier NOT NULL CONSTRAINT DF_Tasks_Id DEFAULT NEWSEQUENTIALID(),
    UserId uniqueidentifier NOT NULL,
    ProjectId uniqueidentifier NULL,
    Title nvarchar(300) NOT NULL,
    Description nvarchar(max) NULL,
    Status varchar(20) NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT 'todo',
    Priority tinyint NOT NULL CONSTRAINT DF_Tasks_Priority DEFAULT 2,
    StartAt datetime2(3) NULL,
    DueAt datetime2(3) NULL,
    EstimatedMinutes int NULL,
    CompletedAt datetime2(3) NULL,
    SortOrder int NOT NULL CONSTRAINT DF_Tasks_SortOrder DEFAULT 0,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Tasks_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Tasks_Updated DEFAULT SYSUTCDATETIME(),
    Version rowversion NOT NULL,
    CONSTRAINT PK_Tasks PRIMARY KEY (TaskId),
    CONSTRAINT UQ_Tasks_Owner UNIQUE (UserId, TaskId),
    CONSTRAINT FK_Tasks_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Tasks_Project FOREIGN KEY (UserId, ProjectId) REFERENCES dbo.Projects(UserId, ProjectId),
    CONSTRAINT CK_Tasks_Title CHECK (LEN(LTRIM(RTRIM(Title))) > 0),
    CONSTRAINT CK_Tasks_Status CHECK (Status IN ('todo', 'in_progress', 'done', 'cancelled')),
    CONSTRAINT CK_Tasks_Priority CHECK (Priority BETWEEN 1 AND 4),
    CONSTRAINT CK_Tasks_Dates CHECK (StartAt IS NULL OR DueAt IS NULL OR DueAt >= StartAt),
    CONSTRAINT CK_Tasks_Estimate CHECK (EstimatedMinutes IS NULL OR EstimatedMinutes > 0),
    CONSTRAINT CK_Tasks_Completed CHECK ((Status = 'done' AND CompletedAt IS NOT NULL) OR (Status <> 'done' AND CompletedAt IS NULL))
);
GO

IF OBJECT_ID(N'dbo.ChecklistItems', N'U') IS NULL
CREATE TABLE dbo.ChecklistItems (
    ChecklistItemId uniqueidentifier NOT NULL CONSTRAINT DF_Checklist_Id DEFAULT NEWSEQUENTIALID(),
    TaskId uniqueidentifier NOT NULL,
    Title nvarchar(300) NOT NULL,
    IsCompleted bit NOT NULL CONSTRAINT DF_Checklist_Completed DEFAULT 0,
    SortOrder int NOT NULL CONSTRAINT DF_Checklist_Order DEFAULT 0,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Checklist_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Checklist_Updated DEFAULT SYSUTCDATETIME(),
    Version rowversion NOT NULL,
    CONSTRAINT PK_ChecklistItems PRIMARY KEY (ChecklistItemId),
    CONSTRAINT FK_Checklist_Task FOREIGN KEY (TaskId) REFERENCES dbo.Tasks(TaskId),
    CONSTRAINT CK_Checklist_Title CHECK (LEN(LTRIM(RTRIM(Title))) > 0)
);
GO

IF OBJECT_ID(N'dbo.Tags', N'U') IS NULL
CREATE TABLE dbo.Tags (
    TagId uniqueidentifier NOT NULL CONSTRAINT DF_Tags_Id DEFAULT NEWSEQUENTIALID(),
    UserId uniqueidentifier NOT NULL,
    Name nvarchar(50) NOT NULL,
    CONSTRAINT PK_Tags PRIMARY KEY (TagId),
    CONSTRAINT UQ_Tags_Owner UNIQUE (UserId, TagId),
    CONSTRAINT UQ_Tags_Name UNIQUE (UserId, Name),
    CONSTRAINT FK_Tags_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Tags_Name CHECK (LEN(LTRIM(RTRIM(Name))) > 0)
);
GO

IF OBJECT_ID(N'dbo.TaskTags', N'U') IS NULL
CREATE TABLE dbo.TaskTags (
    UserId uniqueidentifier NOT NULL,
    TaskId uniqueidentifier NOT NULL,
    TagId uniqueidentifier NOT NULL,
    CONSTRAINT PK_TaskTags PRIMARY KEY (UserId, TaskId, TagId),
    CONSTRAINT FK_TaskTags_Task FOREIGN KEY (UserId, TaskId) REFERENCES dbo.Tasks(UserId, TaskId),
    CONSTRAINT FK_TaskTags_Tag FOREIGN KEY (UserId, TagId) REFERENCES dbo.Tags(UserId, TagId)
);
GO

IF OBJECT_ID(N'dbo.Reminders', N'U') IS NULL
CREATE TABLE dbo.Reminders (
    ReminderId uniqueidentifier NOT NULL CONSTRAINT DF_Reminders_Id DEFAULT NEWSEQUENTIALID(),
    TaskId uniqueidentifier NOT NULL,
    RemindAt datetime2(3) NOT NULL,
    Status varchar(20) NOT NULL CONSTRAINT DF_Reminders_Status DEFAULT 'pending',
    SentAt datetime2(3) NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Reminders_Created DEFAULT SYSUTCDATETIME(),
    Version rowversion NOT NULL,
    CONSTRAINT PK_Reminders PRIMARY KEY (ReminderId),
    CONSTRAINT FK_Reminders_Task FOREIGN KEY (TaskId) REFERENCES dbo.Tasks(TaskId),
    CONSTRAINT CK_Reminders_Status CHECK (Status IN ('pending', 'sent', 'cancelled')),
    CONSTRAINT CK_Reminders_Sent CHECK ((Status = 'sent' AND SentAt IS NOT NULL) OR (Status <> 'sent' AND SentAt IS NULL))
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Tasks_User_Status_Due' AND object_id = OBJECT_ID(N'dbo.Tasks'))
    CREATE INDEX IX_Tasks_User_Status_Due ON dbo.Tasks(UserId, Status, DueAt) INCLUDE (Priority, Title, ProjectId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Tasks_Project' AND object_id = OBJECT_ID(N'dbo.Tasks'))
    CREATE INDEX IX_Tasks_Project ON dbo.Tasks(UserId, ProjectId, SortOrder);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Checklist_Task' AND object_id = OBJECT_ID(N'dbo.ChecklistItems'))
    CREATE INDEX IX_Checklist_Task ON dbo.ChecklistItems(TaskId, SortOrder);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TaskTags_Tag' AND object_id = OBJECT_ID(N'dbo.TaskTags'))
    CREATE INDEX IX_TaskTags_Tag ON dbo.TaskTags(UserId, TagId, TaskId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Reminders_Pending' AND object_id = OBJECT_ID(N'dbo.Reminders'))
    CREATE INDEX IX_Reminders_Pending ON dbo.Reminders(RemindAt) INCLUDE (TaskId) WHERE Status = 'pending';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Reminders_Task' AND object_id = OBJECT_ID(N'dbo.Reminders'))
    CREATE INDEX IX_Reminders_Task ON dbo.Reminders(TaskId);
