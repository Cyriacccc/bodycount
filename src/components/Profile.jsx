
import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  CalendarDays,
  Users,
  Save,
  LogOut,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const avatars = ["🦊", "🐺", "🦁", "🐼", "🐸", "🐯", "🦅", "🐻"];

export default function Profile({ user, onLogout }) {
  const [username, setUsername] = useState(
    user.user_metadata?.username || "MEMBER"
  );
  const [avatar, setAvatar] = useState(
    user.user_metadata?.avatar || "🦊"
  );
  const [groupCount, setGroupCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfileData() {
      setLoadingGroups(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        if (profile.username) setUsername(profile.username);
        if (profile.avatar) setAvatar(profile.avatar);
      }

      const { count, error: groupsError } = await supabase
        .from("group_members")
        .select("group_id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!groupsError) {
        setGroupCount(count || 0);
      }

      setLoadingGroups(false);
    }

    loadProfileData();
  }, [user.id]);

  async function saveProfile(event) {
    event.preventDefault();

    const cleanUsername = username.trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("Le pseudonyme doit contenir entre 3 et 20 caractères.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        username: cleanUsername,
        avatar,
      },
    });

    if (authError) {
      setError(authError.message);
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        avatar: avatar,
      })
      .eq("id", user.id);

    if (profileError) {
      setError(
        "Le compte a été actualisé, mais le profil n'a pas pu être synchronisé : " +
          profileError.message
      );
      setSaving(false);
      return;
    }

    setUsername(cleanUsername);

    // Vérifie et enregistre le défi dans les groupes du joueur.
    const { error: challengeError } = await supabase.rpc(
      "complete_profile_challenge"
    );

    if (challengeError) {
      setMessage("Profil mis à jour. Le défi sera vérifié ultérieurement.");
      console.error("Erreur validation défi :", challengeError);
    } else {
      setMessage(
        "Profil mis à jour ! Défi « Complète ton profil » vérifié."
      );
    }

    setSaving(false);
  }

  const createdAt = new Date(user.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="profile-page">
      <div className="profile-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>MON <span className="green">PROFIL.</span></h1>
          <p>Personnalise ton espace personnel.</p>
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-main-card">
          <div className="profile-card-heading">
            <div className="profile-avatar-large">{avatar}</div>
            <div>
              <span className="profile-label">MEMBRE BODYCOUNT</span>
              <h2>{username}</h2>
              <span className="profile-status">
                <span className="profile-status-dot" />
                Compte actif
              </span>
            </div>
          </div>

          <form onSubmit={saveProfile}>
            <div className="profile-section-title">
              <UserRound size={17} />
              <h3>INFORMATIONS PERSONNELLES</h3>
            </div>

            <label className="profile-field-label" htmlFor="profile-username">
              PSEUDONYME
            </label>
            <input
              id="profile-username"
              className="profile-input"
              type="text"
              minLength={3}
              maxLength={20}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ton pseudonyme"
            />

            <div className="profile-section-title avatar-title">
              <UserRound size={17} />
              <h3>CHOISIR UN AVATAR</h3>
            </div>

            <div className="profile-avatar-options">
              {avatars.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={
                    avatar === item
                      ? "profile-avatar-option selected"
                      : "profile-avatar-option"
                  }
                  onClick={() => setAvatar(item)}
                  aria-label={`Choisir l'avatar ${item}`}
                  aria-pressed={avatar === item}
                >
                  {item}
                </button>
              ))}
            </div>

            {error && <div className="profile-message error">{error}</div>}
            {message && (
              <div className="profile-message success">{message}</div>
            )}

            <button
              className="profile-save-button"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle size={17} className="profile-spinner" />
              ) : (
                <Save size={17} />
              )}
              {saving ? "ENREGISTREMENT..." : "ENREGISTRER LES MODIFICATIONS"}
            </button>
          </form>
        </div>

        <div className="profile-side">
          <div className="profile-info-card">
            <div className="profile-section-title">
              <ShieldCheck size={17} />
              <h3>INFORMATIONS DU COMPTE</h3>
            </div>

            <div className="profile-info-row">
              <div className="profile-info-icon"><Mail size={18} /></div>
              <div>
                <span>ADRESSE E-MAIL</span>
                <strong>{user.email}</strong>
              </div>
            </div>

            <div className="profile-info-row">
              <div className="profile-info-icon"><CalendarDays size={18} /></div>
              <div>
                <span>MEMBRE DEPUIS</span>
                <strong>{createdAt}</strong>
              </div>
            </div>
          </div>

          <div className="profile-info-card">
            <div className="profile-section-title">
              <Users size={17} />
              <h3>MON ACTIVITÉ</h3>
            </div>

            <div className="profile-group-stat">
              <div className="profile-info-icon"><Users size={20} /></div>
              <div>
                <strong>{loadingGroups ? "..." : groupCount}</strong>
                <span>
                  {groupCount > 1 ? "GROUPES REJOINTS" : "GROUPE REJOINT"}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-privacy-card">
            <ShieldCheck size={21} />
            <div>
              <strong>TON ESPACE PRIVÉ</strong>
              <p>Ton profil est réservé aux membres autorisés de tes groupes.</p>
            </div>
          </div>

          <button className="profile-logout-button" onClick={onLogout}>
            <LogOut size={17} />
            SE DÉCONNECTER
          </button>
        </div>
      </div>
    </section>
  );
}
