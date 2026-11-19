
import { useEffect, useState } from "react";
import {
  Trophy,
  Users,
  UserRound,
  Flame,
  Star,
  MessageCircle,
  Target,
  CalendarDays,
  Zap,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import "./Achievements.css";

const STORAGE_BUCKET = "group-experience-photos";

const PERSONAL_CHALLENGES = {
  complete_profile: {
    title: "Complète ton profil",
    description: "Ajoute les informations nécessaires à ton profil.",
    points: 50,
    icon: UserRound,
  },
  join_group: {
    title: "Rejoins un groupe",
    description: "Fais partie d'un groupe Bodycount.",
    points: 25,
    icon: Users,
  },
  start_discussion: {
    title: "Lance une discussion",
    description: "Initie une discussion avec ton groupe.",
    points: 30,
    icon: MessageCircle,
  },
  create_group_challenge: {
    title: "Organise un défi collectif",
    description: "Propose un défi à ton groupe.",
    points: 75,
    icon: Target,
  },
  stay_active: {
    title: "Reste actif",
    description: "Sois actif pendant au moins trois jours différents.",
    points: 100,
    icon: Flame,
  },
  evolve_profile: {
    title: "Fais évoluer ton profil",
    description: "Fais évoluer les informations de ton profil.",
    points: 40,
    icon: Star,
  },
};

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Achievements({ userId }) {
  const [activeTab, setActiveTab] = useState("personal");
  const [personalAchievements, setPersonalAchievements] = useState([]);
  const [groupAchievements, setGroupAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    loadAchievements();
  }, [userId]);

  async function loadAchievements() {
    setLoading(true);
    setError("");

    try {
      // 1. Charger les réussites personnelles
      const { data: personalData, error: personalError } = await supabase
        .from("public_challenge_completions")
        .select("id, challenge_key, points, completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false });

      if (personalError) throw personalError;

      setPersonalAchievements(personalData || []);

      // 2. Récupérer les groupes dont l'utilisateur est membre
      const { data: memberships, error: membershipsError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

      if (membershipsError) throw membershipsError;

      const groupIds = [
        ...new Set((memberships || []).map((membership) => membership.group_id)),
      ];

      if (groupIds.length === 0) {
        setGroupAchievements([]);
        return;
      }

      // 3. Charger les groupes pour récupérer leurs noms
      const { data: groups, error: groupsError } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds);

      if (groupsError) throw groupsError;

      const groupNames = Object.fromEntries(
        (groups || []).map((group) => [group.id, group.name])
      );

      // 4. Récupérer les défis collectifs de ces groupes
      const { data: challenges, error: challengesError } = await supabase
        .from("group_challenges")
        .select("id, title, group_id")
        .in("group_id", groupIds);

      if (challengesError) throw challengesError;

      const challengeIds = (challenges || []).map((challenge) => challenge.id);

      if (challengeIds.length === 0) {
        setGroupAchievements([]);
        return;
      }

      const challengeDetails = Object.fromEntries(
        (challenges || []).map((challenge) => [
          challenge.id,
          {
            title: challenge.title,
            groupId: challenge.group_id,
            groupName: groupNames[challenge.group_id] || "Groupe",
          },
        ])
      );

      // 5. Ne récupérer que les soumissions approuvées
      const { data: submissions, error: submissionsError } = await supabase
        .from("group_challenge_submissions")
        .select(
          "id, challenge_id, user_id, status, submitted_at, reviewed_at, proof_description, photo_path"
        )
        .in("challenge_id", challengeIds)
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false });

      if (submissionsError) throw submissionsError;

      if (!submissions || submissions.length === 0) {
        setGroupAchievements([]);
        return;
      }

      // 6. Récupérer les profils des membres ayant réussi un défi
      const memberIds = [
        ...new Set(submissions.map((submission) => submission.user_id)),
      ];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar")
        .in("id", memberIds);

      if (profilesError) throw profilesError;

      const profileDetails = Object.fromEntries(
        (profiles || []).map((profile) => [profile.id, profile])
      );

      // 7. Générer les URLs temporaires des photos privées
      const achievementsWithDetails = await Promise.all(
        submissions.map(async (submission) => {
          let photoUrl = null;

          if (submission.photo_path) {
            const { data: signedUrlData, error: photoError } =
              await supabase.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(submission.photo_path, 60 * 60);

            if (!photoError) {
              photoUrl = signedUrlData?.signedUrl || null;
            }
          }

          const challenge = challengeDetails[submission.challenge_id];
          const profile = profileDetails[submission.user_id];

          return {
            ...submission,
            challengeTitle: challenge?.title || "Défi collectif",
            groupName: challenge?.groupName || "Groupe",
            username: profile?.username || "Membre",
            avatar: profile?.avatar || null,
            photoUrl,
            displayDate: submission.reviewed_at || submission.submitted_at,
          };
        })
      );

      achievementsWithDetails.sort(
        (a, b) =>
          new Date(b.displayDate || 0) - new Date(a.displayDate || 0)
      );

      setGroupAchievements(achievementsWithDetails);
    } catch (err) {
      console.error("Erreur chargement des réussites :", err);
      setError(
        err.message ||
          "Impossible de charger les réussites pour le moment."
      );
    } finally {
      setLoading(false);
    }
  }

  const totalPersonalXP = personalAchievements.reduce(
    (total, achievement) => total + (achievement.points || 0),
    0
  );

  return (
    <div className="achievements-page">
      <div className="achievements-header">
        <div>
          <span className="achievements-eyebrow">TES ACCOMPLISSEMENTS</span>
          <h1>Réussites</h1>
          <p>
            Chaque défi relevé est une victoire. Retrouve ici tes accomplissements
            et ceux de tes groupes.
          </p>
        </div>

        <button
          className="achievements-refresh"
          onClick={loadAchievements}
          disabled={loading}
          title="Actualiser"
        >
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
        </button>
      </div>

      <div className="achievements-tabs">
        <button
          className={activeTab === "personal" ? "active" : ""}
          onClick={() => setActiveTab("personal")}
        >
          <Trophy size={17} />
          Mes réussites
          <span>{personalAchievements.length}</span>
        </button>

        <button
          className={activeTab === "group" ? "active" : ""}
          onClick={() => setActiveTab("group")}
        >
          <Users size={17} />
          Réussites du groupe
          <span>{groupAchievements.length}</span>
        </button>
      </div>

      {error && (
        <div className="achievements-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="achievements-loading">
          <div className="achievements-loader" />
          <p>Chargement des réussites...</p>
        </div>
      ) : activeTab === "personal" ? (
        <section className="personal-achievements">
          <div className="personal-summary">
            <div className="personal-summary-icon">
              <Zap size={23} />
            </div>
            <div>
              <span>XP gagnés grâce aux missions</span>
              <strong>{totalPersonalXP} XP</strong>
            </div>
            <div className="personal-summary-count">
              <strong>{personalAchievements.length}</strong>
              <span>mission{personalAchievements.length > 1 ? "s" : ""}</span>
            </div>
          </div>

          {personalAchievements.length === 0 ? (
            <div className="achievements-empty">
              <div className="achievements-empty-icon">
                <Trophy size={30} />
              </div>
              <h3>Pas encore de réussite</h3>
              <p>
                Tes missions personnelles validées apparaîtront ici. À toi de jouer !
              </p>
            </div>
          ) : (
            <div className="personal-achievements-grid">
              {personalAchievements.map((achievement) => {
                const details = PERSONAL_CHALLENGES[achievement.challenge_key];
                const Icon = details?.icon || CheckCircle2;

                return (
                  <article
                    className="personal-achievement-card"
                    key={achievement.id}
                  >
                    <div className="personal-achievement-top">
                      <div className="personal-achievement-icon">
                        <Icon size={22} />
                      </div>
                      <span className="achievement-xp">
                        +{achievement.points ?? details?.points ?? 0} XP
                      </span>
                    </div>

                    <h3>
                      {details?.title || achievement.challenge_key}
                    </h3>
                    <p>
                      {details?.description || "Mission accomplie."}
                    </p>

                    <div className="personal-achievement-date">
                      <CheckCircle2 size={14} />
                      Réussie le {formatDate(achievement.completed_at)}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="group-achievements">
          <div className="group-feed-intro">
            <div>
              <h2>Le fil des réussites</h2>
              <p>
                Les défis validés par les membres de tes groupes.
              </p>
            </div>
            <span className="group-feed-private">
              <Users size={14} />
              Groupes privés
            </span>
          </div>

          {groupAchievements.length === 0 ? (
            <div className="achievements-empty">
              <div className="achievements-empty-icon">
                <Users size={30} />
              </div>
              <h3>Aucune réussite collective pour le moment</h3>
              <p>
                Lorsqu'un membre de ton groupe fera approuver un défi, sa réussite
                apparaîtra ici.
              </p>
            </div>
          ) : (
            <div className="group-achievements-feed">
              {groupAchievements.map((achievement) => (
                <article
                  className="group-achievement-post"
                  key={achievement.id}
                >
                  <div className="group-post-header">
                    <div className="group-post-member">
                      {achievement.avatar ? (
                        <img
                          src={achievement.avatar}
                          alt=""
                          className="group-post-avatar"
                        />
                      ) : (
                        <div className="group-post-avatar group-post-avatar-fallback">
                          <UserRound size={20} />
                        </div>
                      )}

                      <div>
                        <strong>{achievement.username}</strong>
                        <span>{achievement.groupName}</span>
                      </div>
                    </div>

                    <span className="group-post-date">
                      {formatDate(achievement.displayDate)}
                    </span>
                  </div>

                  <div className="group-post-challenge">
                    <span className="group-post-label">
                      <Trophy size={14} />
                      DÉFI RÉUSSI
                    </span>
                    <h3>{achievement.challengeTitle}</h3>
                    <div className="group-post-approved">
                      <CheckCircle2 size={14} />
                      Réussite validée
                    </div>
                  </div>

                  {achievement.photoUrl ? (
                    <div className="group-post-photo-wrapper">
                      <img
                        src={achievement.photoUrl}
                        alt={`Preuve de ${achievement.username}`}
                        className="group-post-photo"
                        loading="lazy"
                      />
                    </div>
                  ) : null}

                  {achievement.proof_description && (
                    <div className="group-post-proof">
                      {!achievement.photoUrl && (
                        <ImageIcon size={16} />
                      )}
                      <p>{achievement.proof_description}</p>
                    </div>
                  )}

                  {!achievement.photoUrl &&
                    !achievement.proof_description && (
                      <div className="group-post-no-proof">
                        <CheckCircle2 size={18} />
                        Défi accompli par {achievement.username}
                      </div>
                    )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
