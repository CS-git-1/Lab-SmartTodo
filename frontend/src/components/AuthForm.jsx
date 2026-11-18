import { useState } from "react";
import { completePasswordReset, login, register, requestPasswordReset } from "../api/authApi.js";

function getResetToken() {
    return new URLSearchParams(window.location.search).get("resetToken") || "";
}

export default function AuthForm({ onAuthenticated }) {
    const [mode, setMode] = useState(() => getResetToken() ? "reset" : "login");
    const [resetToken, setResetToken] = useState(getResetToken);
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
            if (mode === "forgot") {
                await requestPasswordReset(email);
                setNotice("If an account exists for that email, password reset instructions will be sent.");
            } else if (mode === "reset") {
                await completePasswordReset(resetToken, password);
                window.history.replaceState({}, document.title, window.location.pathname);
                setResetToken("");
                setPassword("");
                setMode("login");
                setNotice("Password reset successfully. You can now sign in with your new password.");
            } else {
                const result = mode === "login"
                    ? await login(email, password)
                    : await register(email, displayName, password);
                onAuthenticated(result);
            }
        } catch (requestError) {
            setError(requestError.message || "Unable to complete request");
        } finally {
            setBusy(false);
        }
    }

    const title = mode === "login" ? "Sign in"
        : mode === "register" ? "Create account"
            : mode === "forgot" ? "Forgot password" : "Reset password";

    return (
        <main className="app">
            <section className="panel auth-panel">
                <p className="eyebrow">Smart Todo</p>
                <h1>{title}</h1>
                <form className="form auth-form" onSubmit={submit}>
                    {mode === "register" && (
                        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)}
                            maxLength={100} placeholder="Display name" aria-label="Display name" required />
                    )}
                    {mode !== "reset" && (
                        <input type="email" autoComplete="email" value={email}
                            onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Email" required />
                    )}
                    {mode === "reset" && <p>Enter a new password (10–200 characters).</p>}
                    {(mode === "login" || mode === "register" || mode === "reset") && (
                        <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                            minLength={10} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)}
                            placeholder={mode === "login" ? "Password" : "New password (at least 10 characters)"}
                            aria-label={mode === "login" ? "Password" : "New password"} required />
                    )}
                    <button className="add-button" type="submit" disabled={busy}>
                        {busy ? "Please wait…" : mode === "login" ? "Sign in"
                            : mode === "register" ? "Create account"
                                : mode === "forgot" ? "Send reset link" : "Reset password"}
                    </button>
                </form>
                {notice && <p className="form-message success" role="status">{notice}</p>}
                {error && <p className="form-message error" role="alert">{error}</p>}
                {mode === "login" && (
                    <>
                        <button className="filter-button" type="button" onClick={() => { setError(""); setNotice(""); setMode("forgot"); }}>
                            Forgot password?
                        </button>
                        <button className="filter-button" type="button" onClick={() => { setError(""); setMode("register"); }}>
                            Need an account? Register
                        </button>
                    </>
                )}
                {(mode === "register" || mode === "forgot" || mode === "reset") && (
                    <button className="filter-button" type="button" onClick={() => {
                        setError(""); setNotice(""); setPassword(""); setMode("login");
                    }}>
                        Back to sign in
                    </button>
                )}
            </section>
        </main>
    );
}
