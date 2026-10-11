import { useState } from "react";
import { login, register } from "../services/api";

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSubmitting(true);

    try {
      const user =
        mode === "signup"
          ? await register(cleanEmail, password, name.trim())
          : await login(cleanEmail, password);

      onLogin(user);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="auth-screen">

      {/* BACKGROUND DECORATION */}

      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />


      {/* LEFT BRAND PANEL */}

      <section className="auth-brand">

        <div className="auth-brand-content">

          <div className="auth-logo">
            A
          </div>

          <div className="auth-eyebrow">
            ADAPTIVE MULTI-RAG
          </div>

          <h1>
            Research deeper.
            <br />
            Understand faster.
          </h1>

          <p>
            A research intelligence workspace that
            retrieves, ranks, compresses and synthesizes
            evidence from your documents.
          </p>


          <div className="auth-features">

            <Feature
              icon="✦"
              title="Adaptive retrieval"
              text="Query-aware retrieval strategies."
            />

            <Feature
              icon="◈"
              title="Evidence grounded"
              text="Answers stay connected to your sources."
            />

            <Feature
              icon="◉"
              title="Live pipeline"
              text="See how your answer is generated."
            />

          </div>

        </div>

        <div className="auth-footer">
          Adaptive Multi-RAG · Research Intelligence
        </div>

      </section>


      {/* AUTH PANEL */}

      <section className="auth-panel">

        <div className="auth-card">

          <div className="auth-heading">

            <div className="mobile-auth-logo">
              A
            </div>

            <div className="auth-card-eyebrow">
              {mode === "login"
                ? "WELCOME BACK"
                : "GET STARTED"}
            </div>

            <h2>
              {mode === "login"
                ? "Welcome back."
                : "Create your workspace."}
            </h2>

            <p>
              {mode === "login"
                ? "Sign in to continue your research."
                : "Create an account for your personal RAG workspace."}
            </p>

          </div>


          {/* MODE SWITCH */}

          <div className="auth-tabs">

            <button
              className={
                mode === "login"
                  ? "auth-tab active"
                  : "auth-tab"
              }
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>

            <button
              className={
                mode === "signup"
                  ? "auth-tab active"
                  : "auth-tab"
              }
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Create account
            </button>

          </div>


          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            {mode === "signup" && (
              <label>
                <span>Full name</span>

                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  autoComplete="name"
                />
              </label>
            )}


            <label>
              <span>Email address</span>

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
              />
            </label>


            <label>
              <span>Password</span>

              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
              />
            </label>


            {error && (
              <div className="auth-error">
                <span>!</span>
                {error}
              </div>
            )}


            <button
              type="submit"
              className="auth-submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait..."
                : mode === "login"
                ? "Sign in"
                : "Create workspace"}

              <span>
                →
              </span>
            </button>

          </form>


          <div className="auth-note">
            <span>●</span>
            Your workspace is isolated to your account.
          </div>

        </div>

      </section>

    </div>
  );
}


function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="auth-feature">

      <div className="auth-feature-icon">
        {icon}
      </div>

      <div>
        <strong>
          {title}
        </strong>

        <span>
          {text}
        </span>
      </div>

    </div>
  );
}


export default AuthScreen;
