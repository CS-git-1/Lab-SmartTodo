import { useState } from "react";
import { login, register } from "../api/authApi.js";

export default function AuthForm({ onAuthenticated }) {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const result = mode === "login"
                ? await login(email, password)
                : await register(email, displayName, password);
            onAuthenticated(result);
        } catch (requestError) {
            setError(requestError.message || "Unable to sign in");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="app">
            <section className="panel auth-panel">
                <p className="eyebrow">Smart Todo</p>
                <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
                <form className="form auth-form" onSubmit={submit}>
                    {mode === "register" && (
                        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)}
                            maxLength={100} placeholder="Display name" aria-label="Display name" required />
                    )}
                    <input type="email" autoComplete="email" value={email}
                        onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Email" required />
                    <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                        minLength={10} value={password} onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password (at least 10 characters)" aria-label="Password" required />
                    <button className="add-button" type="submit" disabled={busy}>
                        {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                    </button>
                </form>
                <p className="form-message error" role="alert">{error}</p>
                <button className="filter-button" type="button" onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>
                    {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
                </button>
            </section>
        </main>
    );
}
