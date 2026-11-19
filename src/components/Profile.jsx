
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
  Bell,
  BellOff,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const avatars = ["🦊", "🐺", "🦁", "🐼", "🐸", "🐯", "🦅", "🐻"];

const VAPID_PUBLIC_KEY =
  "BLA5N_ip7yvYtCujFJU_4pKCUYU-evYKMeNMn9DZUq3Jlo4VW6AEC9RjjoBoGCM6zW3WOPXuGKUh-AjlXL-EZFI";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

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

  const [pushSupported, setPushSupported] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushError, setPushError] = useState("");

  async function savePushSubscription(subscription) {
    const subscriptionData = subscription.toJSON();

    if (!subscriptionData.keys?.p256dh || !subscriptionData.keys?.auth) {
      throw new Error("Les clés de l'abonnement Push sont introuvables.");
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
          platform: isIOS ? "ios" : "web",
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (error) throw error;
  }

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

  useEffect(() => {
    let active = true;

    async function checkPushSupport() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined"
      ) {
        if (active) setPushSupported(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          await registration.pushManager.getSubscription();

        if (!active) return;

        setPushSupported(true);
        setPushEnabled(Boolean(subscription));

        if (subscription) {
          await savePushSubscription(subscription);
        }
      } catch (err) {
        console.error("Erreur vérification Push :", err);
        if (active) {
          setPushSupported(false);
          setPushError("Impossible de vérifier les notifications sur cet appareil.");
        }
      }
    }

    checkPushSupport();

    return () => {
      active = false;
    };
  }, [user.id]);

  async function enablePush() {
    setPushLoading(true);
    setPushError("");
    setPushMessage("");

    try {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true;

      if (isIOS && !isStandalone) {
        throw new Error(
          "Sur iPhone, ajoute d'abord BODYCOUNT à ton écran d'accueil, puis ouvre l'application depuis son icône."
        );
      }

      if (Notification.permission === "denied") {
        throw new Error(
          "Les notifications sont bloquées dans les réglages de ton navigateur ou de ton iPhone."
        );
      }

      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        throw new Error("Tu n'as pas autorisé les notifications.");
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await savePushSubscription(subscription);

      setPushEnabled(true);
      setPushMessage("Notifications activées sur cet appareil !");
    } catch (err) {
      console.error("Erreur activation Push :", err);
      setPushError(err.message || "Impossible d'activer les notifications.");
    } finally {
      setPushLoading(false);
    }
  }

  async function disablePush() {
    setPushLoading(true);
    setPushError("");
    setPushMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        await registration.pushManager.getSubscription();

      if (subscription) {
        const { error: deleteError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        if (deleteError) throw deleteError;

        await subscription.unsubscribe();
      }

      setPushEnabled(false);
      setPushMessage("Notifications désactivées sur cet appareil.");
    } catch (err) {
      console.error("Erreur désactivation Push :", err);
      setPushError(err.message || "Impossible de désactiver les notifications.");
    } finally {
      setPushLoading(false);
    }
  }

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
              <Bell size={17} />
              <h3>NOTIFICATIONS PUSH</h3>
            </div>

            <p>
              Reçois les notifications BODYCOUNT même lorsque l'application
              est fermée.
            </p>

            {pushSupported === false && (
              <div className="profile-message error">
                Les notifications Push ne sont pas disponibles sur cet appareil.
              </div>
            )}

            {pushSupported === null && (
              <p>Vérification de la compatibilité...</p>
            )}

            {pushSupported && (
              <>
                <p>
                  Statut : <strong>{pushEnabled ? "Activées" : "Désactivées"}</strong>
                </p>

                <button
                  className="profile-save-button"
                  type="button"
                  onClick={pushEnabled ? disablePush : enablePush}
                  disabled={pushLoading}
                >
                  {pushLoading ? (
                    <LoaderCircle size={17} className="profile-spinner" />
                  ) : pushEnabled ? (
                    <BellOff size={17} />
                  ) : (
                    <Bell size={17} />
                  )}

                  {pushLoading
                    ? "PATIENTE..."
                    : pushEnabled
                      ? "DÉSACTIVER LES NOTIFICATIONS"
                      : "ACTIVER LES NOTIFICATIONS"}
                </button>
              </>
            )}

            {pushError && (
              <div className="profile-message error">{pushError}</div>
            )}

            {pushMessage && (
              <div className="profile-message success">{pushMessage}</div>
            )}
          </div>

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
