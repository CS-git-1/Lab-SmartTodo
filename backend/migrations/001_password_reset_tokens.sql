IF OBJECT_ID(N'dbo.PasswordResetTokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasswordResetTokens (
        UserId uniqueidentifier NOT NULL,
        TokenHash char(64) NOT NULL,
        ExpiresAt datetime2(3) NOT NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_PasswordResetTokens_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_PasswordResetTokens PRIMARY KEY (UserId),
        CONSTRAINT UQ_PasswordResetTokens_TokenHash UNIQUE (TokenHash),
        CONSTRAINT FK_PasswordResetTokens_User FOREIGN KEY (UserId)
            REFERENCES dbo.Users(UserId) ON DELETE CASCADE
    );
END;
GO
