
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Mail, Lock, User, Zap, ArrowRight } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [adult, setAdult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase n'est pas encore configuré.");
      return;
    }

    if (mode === "signup" && !adult) {
      setMessage("Tu dois confirmer avoir au moins 18 ans.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Compte créé avec succès !");
        } else {
          setMessage(
            "Compte créé ! Vérifie tes e-mails pour confirmer ton inscription."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow" />

      <div className="auth-container">
        <div className="brand">
          <div className="brand-icon">
            <Zap size={25} fill="currentColor" />
          </div>
          <span>BODY<span className="green">COUNT</span></span>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">THE PRIVATE CLUB</span>
            <h1>
              {mode === "login" ? "WELCOME BACK." : "JOIN THE CLUB."}
            </h1>
            <p>
              {mode === "login"
                ? "Connecte-toi pour retrouver ton espace."
                : "Crée ton compte et rejoins ton groupe."}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="field">
                <label>PSEUDONYME</label>
                <div className="input-wrap">
                  <User size={18} />
                  <input
                    type="text"
                    placeholder="Ton pseudo"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    minLength={3}
                    maxLength={20}
                    required
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label>ADRESSE E-MAIL</label>
              <div className="input-wrap">
                <Mail size={18} />
                <input
                  type="email"
                  placeholder="exemple@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>MOT DE PASSE</label>
              <div className="input-wrap">
                <Lock size={18} />
                <input
                  type="password"
                  placeholder="Minimum 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete={
                    mode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />
              </div>
            </div>

            {mode === "signup" && (
              <label className="adult-check">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                <span>Je confirme avoir au moins 18 ans.</span>
              </label>
            )}

            {message && (
              <div className="auth-message" role="status">
                {message}
              </div>
            )}

            <button className="submit-btn" disabled={loading}>
              {loading
                ? "CHARGEMENT..."
                : mode === "login"
                  ? "SE CONNECTER"
                  : "CRÉER MON COMPTE"}
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login" ? (
              <>
                Pas encore de compte ?
                <button onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}>
                  S'inscrire
                </button>
              </>
            ) : (
              <>
                Déjà membre ?
                <button onClick={() => {
                  setMode("login");
                  setMessage("");
                }}>
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>

        <p className="auth-footer">
          PRIVATE COMMUNITY · 18+ · YOUR DATA, YOUR CONTROL
        </p>
      </div>
    </main>
  );
}
