
import { useEffect, useState, useCallback } from "react";

import Auth from "./components/Auth";
import Groups from "./components/Groups";
import Profile from "./components/Profile";
import Ranking from "./components/Ranking";
import Challenges from "./components/Challenges";
import Discussions from "./components/Discussions";
import Experiences from "./components/Experiences";

import { supabase } from "./lib/supabase";

import {
  Trophy,
  Users,
  User,
  LogOut,
  Zap,
  ShieldCheck,
  Target,
  MessageCircle,
  Heart,
} from "lucide-react";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ranking");

  const [notificationCounts, setNotificationCounts] = useState({
    challenge: 0,
    discussion: 0,
    experience: 0,
  });

  const userId = session?.user?.id;

  // Charger les notifications non lues
  const loadNotifications = useCallback(async () => {
    if (!userId || !supabase) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("notification_type")
      .eq("recipient_id", userId)
      .is("read_at", null);

    if (error) {
      console.error("Erreur notifications :", error);
      return;
    }

    const counts = {
      challenge: 0,
      discussion: 0,
      experience: 0,
    };

    (data || []).forEach((notification) => {
      const type = notification.notification_type;

      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });

    setNotificationCounts(counts);
  }, [userId]);

  // Marquer les notifications d'une catégorie comme lues
  const markNotificationsAsRead = useCallback(
    async (type) => {
      if (!userId || !supabase) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", userId)
        .eq("notification_type", type)
        .is("read_at", null);

      if (error) {
        console.error("Erreur lors du marquage comme lu :", error);
        return;
      }

      await loadNotifications();
    },
    [userId, loadNotifications]
  );

  // Changer d'onglet et marquer les notifications correspondantes comme lues
  function handleTabChange(newTab) {
    setTab(newTab);

    const notificationTypeByTab = {
      challenges: "challenge",
      discussions: "discussion",
      experiences: "experience",
    };

    const notificationType = notificationTypeByTab[newTab];

    if (notificationType) {
      markNotificationsAsRead(notificationType);
    }
  }

  // Session utilisateur
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) {
          setSession(session);
        }
      });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Charger les notifications et écouter les nouvelles
  useEffect(() => {
    if (!userId || !supabase) {
      setNotificationCounts({
        challenge: 0,
        discussion: 0,
        experience: 0,
      });
      return;
    }

    loadNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  async function logout() {
    await supabase.auth.signOut();

    setNotificationCounts({
      challenge: 0,
      discussion: 0,
      experience: 0,
    });
  }

  function renderBadge(type) {
    const count = notificationCounts[type] || 0;

    if (count === 0) return null;

    return (
      <span className="notification-badge">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        BODYCOUNT<span>.</span>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="loading-screen">
        Configure ton fichier .env pour démarrer BODYCOUNT.
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const username =
    session.user.user_metadata?.username || "MEMBER";

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Zap size={24} fill="currentColor" />
          </div>
          <span>
            BODY<span className="green">COUNT</span>
          </span>
        </div>

        <div className="sidebar-label">
          MENU PRINCIPAL
        </div>

        <button
          className={tab === "ranking" ? "nav-item active" : "nav-item"}
          onClick={() => handleTabChange("ranking")}
        >
          <Trophy size={19} />
          Classement
        </button>

        <button
          className={tab === "challenges" ? "nav-item active" : "nav-item"}
          onClick={() => handleTabChange("challenges")}
        >
          <Target size={19} />
          Challenges
          {renderBadge("challenge")}
        </button>

        <button
          className={tab === "discussions" ? "nav-item active" : "nav-item"}
          onClick={() => handleTabChange("discussions")}
        >
          <MessageCircle size={19} />
          Discussions
          {renderBadge("discussion")}
        </button>

        <button
          className={tab === "experiences" ? "nav-item active" : "nav-item"}
          onClick={() => handleTabChange("experiences")}
        >
          <Heart size={19} />
          Expériences
          {renderBadge("experience")}
        </button>

        <button
          className={tab === "groups" ? "nav-item active" : "nav-item"}
          onClick={() => handleTabChange("groups")}
        >
          <Users size={19} />
          Mes groupes
        </button>

        <button
          className={tab === "profile" ? "nav-item active" : "nav-item"}
          onClick={() => handleTabChange("profile")}
        >
          <User size={19} />
          Mon profil
        </button>

        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <span>
              Espace privé
              <br />
              Données protégées
            </span>
          </div>

          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">PRIVATE CLUB</span>
            <h2>
              {tab === "ranking" && "LEADERBOARD"}
              {tab === "challenges" && "CHALLENGES"}
              {tab === "discussions" && "DISCUSSIONS"}
              {tab === "experiences" && "EXPÉRIENCES"}
              {tab === "groups" && "MES GROUPES"}
              {tab === "profile" && "MON PROFIL"}
            </h2>
          </div>

          <div className="user-chip">
            <div className="avatar">
              {username.charAt(0).toUpperCase()}
            </div>
            <span>{username}</span>
          </div>
        </header>

        {tab === "ranking" && (
          <Ranking userId={session.user.id} />
        )}

        {tab === "challenges" && (
          <Challenges userId={session.user.id} />
        )}

        {tab === "discussions" && (
          <Discussions userId={session.user.id} />
        )}

        {tab === "experiences" && (
          <Experiences userId={session.user.id} />
        )}

        {tab === "groups" && (
          <Groups userId={session.user.id} />
        )}

        {tab === "profile" && (
          <Profile user={session.user} onLogout={logout} />
        )}
      </main>
    </div>
  );
}
