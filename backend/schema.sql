/* Smart Todo database schema for Microsoft SQL Server.
   Run this script in SSMS or with sqlcmd. */

IF DB_ID(N'SmartTodo') IS NULL
    CREATE DATABASE SmartTodo;
GO

USE SmartTodo;
GO

/* App users. Keep password hashes only; never store plaintext passwords. */
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserId          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
        Email           NVARCHAR(320) NOT NULL,
        DisplayName     NVARCHAR(120) NOT NULL,
        PasswordHash    NVARCHAR(512) NOT NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
        IsActive        BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );
END;
GO

/* Todo lists owned by a user. */
IF OBJECT_ID(N'dbo.TodoLists', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TodoLists (
        TodoListId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TodoLists PRIMARY KEY,
        UserId          BIGINT NOT NULL,
        Name            NVARCHAR(120) NOT NULL,
        Description     NVARCHAR(500) NULL,
        SortOrder       INT NOT NULL CONSTRAINT DF_TodoLists_SortOrder DEFAULT (0),
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_TodoLists_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_TodoLists_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_TodoLists_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
    );
    CREATE INDEX IX_TodoLists_UserId_SortOrder ON dbo.TodoLists(UserId, SortOrder);
END;
GO

/* Tasks support due dates, priority, completion, and optional list grouping. */
IF OBJECT_ID(N'dbo.Todos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Todos (
        TodoId          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Todos PRIMARY KEY,
        UserId          BIGINT NOT NULL,
        TodoListId      BIGINT NULL,
        Title           NVARCHAR(200) NOT NULL,
        Description     NVARCHAR(MAX) NULL,
        Status          VARCHAR(20) NOT NULL CONSTRAINT DF_Todos_Status DEFAULT ('pending'),
        Priority        TINYINT NOT NULL CONSTRAINT DF_Todos_Priority DEFAULT (2),
        DueAt           DATETIME2(0) NULL,
        CompletedAt     DATETIME2(0) NULL,
        SortOrder       INT NOT NULL CONSTRAINT DF_Todos_SortOrder DEFAULT (0),
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Todos_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Todos_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Todos_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_Todos_TodoLists FOREIGN KEY (TodoListId) REFERENCES dbo.TodoLists(TodoListId) ON DELETE SET NULL,
        CONSTRAINT CK_Todos_Status CHECK (Status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        CONSTRAINT CK_Todos_Priority CHECK (Priority BETWEEN 1 AND 3)
    );
    CREATE INDEX IX_Todos_UserId_Status_DueAt ON dbo.Todos(UserId, Status, DueAt);
    CREATE INDEX IX_Todos_TodoListId_SortOrder ON dbo.Todos(TodoListId, SortOrder);
END;
GO

/* Optional labels; a todo can have multiple labels. */
IF OBJECT_ID(N'dbo.Tags', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tags (
        TagId           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tags PRIMARY KEY,
        UserId          BIGINT NOT NULL,
        Name            NVARCHAR(50) NOT NULL,
        Color           CHAR(7) NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Tags_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Tags_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CONSTRAINT UQ_Tags_UserId_Name UNIQUE (UserId, Name)
    );
END;
GO

IF OBJECT_ID(N'dbo.TodoTags', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TodoTags (
        TodoId          BIGINT NOT NULL,
        TagId           BIGINT NOT NULL,
        CONSTRAINT PK_TodoTags PRIMARY KEY (TodoId, TagId),
        CONSTRAINT FK_TodoTags_Todos FOREIGN KEY (TodoId) REFERENCES dbo.Todos(TodoId) ON DELETE CASCADE,
        CONSTRAINT FK_TodoTags_Tags FOREIGN KEY (TagId) REFERENCES dbo.Tags(TagId) ON DELETE CASCADE
    );
    CREATE INDEX IX_TodoTags_TagId ON dbo.TodoTags(TagId);
END;
GO

/* Checklist items belonging to a task. */
IF OBJECT_ID(N'dbo.TodoSubtasks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TodoSubtasks (
        TodoSubtaskId   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TodoSubtasks PRIMARY KEY,
        TodoId          BIGINT NOT NULL,
        Title           NVARCHAR(200) NOT NULL,
        IsCompleted     BIT NOT NULL CONSTRAINT DF_TodoSubtasks_IsCompleted DEFAULT (0),
        SortOrder       INT NOT NULL CONSTRAINT DF_TodoSubtasks_SortOrder DEFAULT (0),
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_TodoSubtasks_CreatedAt DEFAULT SYSUTCDATETIME(),
        CompletedAt     DATETIME2(0) NULL,
        CONSTRAINT FK_TodoSubtasks_Todos FOREIGN KEY (TodoId) REFERENCES dbo.Todos(TodoId) ON DELETE CASCADE
    );
    CREATE INDEX IX_TodoSubtasks_TodoId_SortOrder ON dbo.TodoSubtasks(TodoId, SortOrder);
END;
GO
