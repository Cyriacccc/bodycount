
import { useEffect, useState, useCallback } from "react";
import "./App.css";
import Auth from "./components/Auth";
import Groups from "./components/Groups";
import Profile from "./components/Profile";
import Ranking from "./components/Ranking";
import Challenges from "./components/Challenges";
import Achievements from "./components/Achievements";
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
  CheckCircle2,
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

  // Récupération des notifications non lues
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

  // Marquer les notifications comme lues
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

  // Navigation entre les pages
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

  // Vérification de la session utilisateur
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

  // Écoute des notifications en temps réel
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

  // Déconnexion
  async function logout() {
    await supabase.auth.signOut();

    setNotificationCounts({
      challenge: 0,
      discussion: 0,
      experience: 0,
    });
  }

  // Badge de notification
  function renderBadge(type) {
    const count = notificationCounts[type] || 0;

    if (count === 0) return null;

    return (
      <span className="notification-badge">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  // Écrans de chargement
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

  // Navigation principale
  const navigationItems = [
    {
      id: "ranking",
      label: "Classement",
      icon: Trophy,
    },
    {
      id: "challenges",
      label: "Challenges",
      icon: Target,
      badge: "challenge",
    },
    {
      id: "achievements",
      label: "Réussites",
      icon: CheckCircle2,
    },
    {
      id: "discussions",
      label: "Discussions",
      icon: MessageCircle,
      badge: "discussion",
    },
    {
      id: "experiences",
      label: "Expériences",
      icon: Heart,
      badge: "experience",
    },
    {
      id: "groups",
      label: "Mes groupes",
      icon: Users,
    },
    {
      id: "profile",
      label: "Mon profil",
      icon: User,
    },
  ];

  // Titres des pages
  const pageTitles = {
    ranking: "LEADERBOARD",
    challenges: "CHALLENGES",
    achievements: "RÉUSSITES",
    discussions: "DISCUSSIONS",
    experiences: "EXPÉRIENCES",
    groups: "MES GROUPES",
    profile: "MON PROFIL",
  };

  return (
    <div className="dashboard">

      {/* NAVIGATION LATÉRALE */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="brand">
          <div className="brand-icon">
            <Zap size={24} fill="currentColor" />
          </div>

          <span className="brand-name">
            BODY<span className="green">COUNT</span>
          </span>
        </div>

        {/* Menu principal */}
        <nav className="sidebar-nav" aria-label="Navigation principale">

          <div className="sidebar-label">
            MENU PRINCIPAL
          </div>

          <div className="nav-items">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => handleTabChange(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                >
                  <span className="nav-icon">
                    <Icon size={19} />
                  </span>

                  <span className="nav-item-label">
                    {item.label}
                  </span>

                  {item.badge && renderBadge(item.badge)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Partie inférieure */}
        <div className="sidebar-bottom">

          <div className="privacy-note">
            <ShieldCheck size={19} />

            <span className="privacy-text">
              Espace privé
              <br />
              Données protégées
            </span>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={logout}
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut size={18} />

            <span className="logout-label">
              Déconnexion
            </span>
          </button>

        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <main className="main-content">

        {/* EN-TÊTE DE PAGE */}
        <header className="topbar">

          <div className="page-heading">
            <span className="eyebrow">
              PRIVATE CLUB
            </span>

            <h2>
              {pageTitles[tab]}
            </h2>
          </div>

          <div className="user-chip">

            <div className="avatar">
              {username.charAt(0).toUpperCase()}
            </div>

            <span>
              {username}
            </span>

          </div>
        </header>

        {/* PAGES */}
        <div className="page-content">

          {tab === "ranking" && (
            <Ranking userId={session.user.id} />
          )}

          {tab === "challenges" && (
            <Challenges userId={session.user.id} />
          )}

          {tab === "achievements" && (
            <Achievements userId={session.user.id} />
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
            <Profile
              user={session.user}
              onLogout={logout}
            />
          )}

        </div>
      </main>
    </div>
  );
}
