

import { useEffect, useState } from "react";
import {
  Trophy,
  Crown,
  Medal,
  Users,
  Zap,
  Star,
  LoaderCircle,
  Target,
  TrendingUp,
  Heart,
} from "lucide-react";
import { supabase } from "../lib/supabase";

function getLevel(xp) {
  return Math.floor(xp / 100) + 1;
}

function getBadge(xp) {
  if (xp >= 500) return "ÉLITE";
  if (xp >= 200) return "CHALLENGER";
  if (xp >= 100) return "MEMBRE ACTIF";
  if (xp >= 50) return "PREMIERS PAS";
  return "NOUVEAU";
}

function getProgress(xp) {
  return xp % 100;
}

export default function Ranking({ userId }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [players, setPlayers] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadGroups() {
      setLoadingGroups(true);
      setError("");

      const { data: memberships, error: membershipError } =
        await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", userId);

      if (membershipError) {
        setError(membershipError.message);
        setLoadingGroups(false);
        return;
      }

      const groupIds = memberships.map((item) => item.group_id);

      if (groupIds.length === 0) {
        setGroups([]);
        setSelectedGroup("");
        setLoadingGroups(false);
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds)
        .order("created_at", { ascending: false });

      if (groupError) {
        setError(groupError.message);
        setLoadingGroups(false);
        return;
      }

      setGroups(groupData || []);

      if (groupData?.length > 0) {
        setSelectedGroup(groupData[0].id);
      }

      setLoadingGroups(false);
    }

    if (userId) loadGroups();
    else setLoadingGroups(false);
  }, [userId]);

  useEffect(() => {
    if (!selectedGroup) {
      setPlayers([]);
      return;
    }

    async function loadRanking() {
      setLoadingRanking(true);
      setError("");

      const { data: memberships, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", selectedGroup);

      if (membersError) {
        setError(membersError.message);
        setLoadingRanking(false);
        return;
      }

      const userIds = memberships.map((member) => member.user_id);

      if (userIds.length === 0) {
        setPlayers([]);
        setLoadingRanking(false);
        return;
      }

      const [
        { data: profiles, error: profilesError },
        { data: xpEvents, error: xpError },
        { data: submissions, error: submissionsError },
        { data: experiences, error: experiencesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, avatar")
          .in("id", userIds),

        supabase
          .from("xp_events")
          .select("user_id, points")
          .eq("group_id", selectedGroup),

        supabase
          .from("group_challenge_submissions")
          .select("user_id, challenge_id, status")
          .eq("status", "approved"),

        supabase
          .from("group_experiences")
          .select("user_id")
          .eq("group_id", selectedGroup)
          .eq("is_deleted", false),
      ]);

      if (
        profilesError ||
        xpError ||
        submissionsError ||
        experiencesError
      ) {
        setError(
          profilesError?.message ||
          xpError?.message ||
          submissionsError?.message ||
          experiencesError?.message ||
          "Impossible de charger le classement."
        );
        setLoadingRanking(false);
        return;
      }

      const xpByUser = {};
      const challengesByUser = {};
      const experiencesByUser = {};

      (xpEvents || []).forEach((event) => {
        xpByUser[event.user_id] =
          (xpByUser[event.user_id] || 0) + event.points;
      });

      // Récupérer les défis du groupe sélectionné.
      const groupChallengeIdsResult = await supabase
        .from("group_challenges")
        .select("id")
        .eq("group_id", selectedGroup);

      if (groupChallengeIdsResult.error) {
        setError(groupChallengeIdsResult.error.message);
        setLoadingRanking(false);
        return;
      }

      const groupChallengeIds = new Set(
        (groupChallengeIdsResult.data || []).map(
          (challenge) => challenge.id
        )
      );

      // Compter les défis validés.
      (submissions || []).forEach((submission) => {
        if (
          userIds.includes(submission.user_id) &&
          groupChallengeIds.has(submission.challenge_id)
        ) {
          challengesByUser[submission.user_id] =
            (challengesByUser[submission.user_id] || 0) + 1;
        }
      });

      // Compter les expériences publiées et non supprimées.
      (experiences || []).forEach((experience) => {
        experiencesByUser[experience.user_id] =
          (experiencesByUser[experience.user_id] || 0) + 1;
      });

      const ranking = (profiles || [])
        .map((profile) => {
          const xp = xpByUser[profile.id] || 0;

          return {
            id: profile.id,
            username: profile.username || "MEMBER",
            avatar: profile.avatar || "🦊",
            xp,
            level: getLevel(xp),
            progress: getProgress(xp),
            badge: getBadge(xp),
            completedChallenges: challengesByUser[profile.id] || 0,
            completedExperiences: experiencesByUser[profile.id] || 0,
          };
        })
        .sort(
          (a, b) =>
            b.xp - a.xp ||
            a.username.localeCompare(b.username)
        );

      setPlayers(ranking);
      setLoadingRanking(false);
    }

    loadRanking();
  }, [selectedGroup]);

  if (loadingGroups) {
    return (
      <div className="ranking-loading">
        <LoaderCircle className="ranking-spinner" size={25} />
        Chargement de tes groupes...
      </div>
    );
  }

  const currentPlayer = players.find((player) => player.id === userId);
  const currentPosition =
    players.findIndex((player) => player.id === userId) + 1;

  return (
    <section className="ranking-page">
      <div className="ranking-heading">
        <div>
          <span className="eyebrow">YOUR COMMUNITY</span>
          <h1>LE <span className="green">CLASSEMENT.</span></h1>
          <p>Compare ta progression avec les membres de tes groupes.</p>
        </div>
        <div className="ranking-heading-icon">
          <Trophy size={30} />
        </div>
      </div>

      {error && (
        <div className="ranking-error">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="ranking-empty">
          <Users size={35} />
          <h2>AUCUN GROUPE POUR LE MOMENT</h2>
          <p>Rejoins ou crée un groupe pour découvrir ton classement.</p>
        </div>
      ) : (
        <>
          <div className="ranking-toolbar">
            <div>
              <span className="ranking-toolbar-label">
                GROUPE SÉLECTIONNÉ
              </span>
              <select
                className="ranking-select"
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ranking-member-count">
              <Users size={17} />
              {players.length} membre{players.length > 1 ? "s" : ""}
            </div>
          </div>

          {loadingRanking ? (
            <div className="ranking-loading">
              <LoaderCircle className="ranking-spinner" size={25} />
              Chargement du classement...
            </div>
          ) : (
            <>
              {currentPlayer && (
                <div className="ranking-my-stats">
                  <div className="ranking-my-stats-heading">
                    <div>
                      <span className="eyebrow">TA PROGRESSION</span>
                      <h2>TON ESPACE.</h2>
                    </div>
                    <TrendingUp size={23} />
                  </div>

                  <div className="ranking-my-stats-grid">
                    <div>
                      <span>POSITION</span>
                      <strong>#{currentPosition}</strong>
                    </div>
                    <div>
                      <span>EXPÉRIENCE</span>
                      <strong>{currentPlayer.xp} XP</strong>
                    </div>
                    <div>
                      <span>NIVEAU</span>
                      <strong>{currentPlayer.level}</strong>
                    </div>
                    <div>
                      <span>DÉFIS VALIDÉS</span>
                      <strong>{currentPlayer.completedChallenges}</strong>
                    </div>
                    <div>
                      <span>EXPÉRIENCES RÉALISÉES</span>
                      <strong>{currentPlayer.completedExperiences}</strong>
                    </div>
                  </div>

                  <div className="ranking-progress-label">
                    <span>
                      PROGRESSION VERS LE NIVEAU {currentPlayer.level + 1}
                    </span>
                    <strong>{currentPlayer.progress}/100 XP</strong>
                  </div>

                  <div className="ranking-progress-track">
                    <div
                      className="ranking-progress-fill"
                      style={{ width: `${currentPlayer.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {players.length > 0 && (
                <div className="ranking-podium">
                  {players.slice(0, 3).map((player, index) => {
                    const position = index + 1;
                    const PodiumIcon =
                      position === 1 ? Crown : position === 2 ? Medal : Star;

                    return (
                      <div
                        key={player.id}
                        className={`ranking-podium-card place-${position}`}
                      >
                        <div className="ranking-podium-position">
                          <PodiumIcon size={19} />
                          <span>#{position}</span>
                        </div>

                        <div className="ranking-podium-avatar">
                          {player.avatar}
                        </div>

                        <strong>{player.username}</strong>
                        <span className="ranking-podium-xp">
                          {player.xp} XP
                        </span>
                        <span className="ranking-podium-level">
                          NIVEAU {player.level}
                        </span>
                        <span className="ranking-podium-challenges">
                          <Target size={13} />
                          {player.completedChallenges} défis
                        </span>
                        <span className="ranking-podium-challenges">
                          <Heart size={13} />
                          {player.completedExperiences} expériences
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="ranking-list-card">
                <div className="ranking-list-heading">
                  <div>
                    <span className="eyebrow">LEADERBOARD</span>
                    <h2>TOUS LES MEMBRES</h2>
                  </div>
                  <Trophy size={22} />
                </div>

                {players.length === 0 ? (
                  <p className="ranking-no-players">
                    Aucun membre à afficher.
                  </p>
                ) : (
                  players.map((player, index) => (
                    <div
                      key={player.id}
                      className={
                        player.id === userId
                          ? "ranking-player current-player"
                          : "ranking-player"
                      }
                    >
                      <div className="ranking-player-position">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="ranking-player-avatar">
                        {player.avatar}
                      </div>

                      <div className="ranking-player-identity">
                        <strong>
                          {player.username}
                          {player.id === userId && (
                            <span className="ranking-you">TOI</span>
                          )}
                        </strong>
                        <span>{player.badge}</span>
                      </div>

                      <div className="ranking-player-level">
                        NIV. {player.level}
                      </div>

                      <div className="ranking-player-xp">
                        <Zap size={15} />
                        {player.xp} XP
                      </div>

                      <div className="ranking-player-challenges">
                        <Target size={15} />
                        {player.completedChallenges}
                      </div>

                      <div className="ranking-player-challenges">
                        <Heart size={15} />
                        {player.completedExperiences}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
