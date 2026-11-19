
import { useEffect, useState } from "react";
import {
  Trophy,
  Zap,
  Users,
  UserRound,
  MessageCircle,
  Target,
  CalendarDays,
  Lock,
  CheckCircle2,
  Flame,
  Star,
  Plus,
  X,
  LoaderCircle,
  Clock,
  Check,
  XCircle,
  ImagePlus,
  FileText,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const STORAGE_BUCKET = "group-experience-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const filters = ["TOUS", "PROFIL", "SOCIAL", "GROUPE", "RÉGULARITÉ"];

const initialChallenges = [
  {
    id: 1,
    challengeKey: "complete_profile",
    title: "Complète ton profil",
    description: "Choisis ton pseudonyme et personnalise ton avatar.",
    xp: 50,
    category: "Profil",
    icon: UserRound,
    difficulty: "FACILE",
  },
  {
    id: 2,
    challengeKey: "join_group",
    title: "Rejoins un groupe",
    description: "Intègre un groupe et commence à participer.",
    xp: 25,
    category: "Social",
    icon: Users,
    difficulty: "FACILE",
  },
  {
    id: 3,
    challengeKey: "start_discussion",
    title: "Lance une discussion",
    description: "Propose un sujet de discussion aux membres de ton groupe.",
    xp: 30,
    category: "Social",
    icon: MessageCircle,
    difficulty: "MOYEN",
  },
  {
    id: 4,
    challengeKey: "create_group_challenge",
    title: "Organise un défi collectif",
    description: "Propose une activité à réaliser avec les membres de ton groupe.",
    xp: 75,
    category: "Groupe",
    icon: Target,
    difficulty: "DIFFICILE",
  },
  {
    id: 5,
    challengeKey: "stay_active",
    title: "Reste actif",
    description:
      "Participe à la vie de ton groupe pendant au moins trois jours distincts.",
    xp: 100,
    category: "Régularité",
    icon: Flame,
    difficulty: "DIFFICILE",
  },
  {
    id: 6,
    challengeKey: "evolve_profile",
    title: "Fais évoluer ton profil",
    description: "Personnalise à nouveau ton profil après l'avoir complété.",
    xp: 40,
    category: "Profil",
    icon: Star,
    difficulty: "FACILE",
  },
];

function getSubmissionPoints(challenge, submission) {
  const basePoints = Number(challenge.xp) || 0;
  const descriptionBonus =
    submission.proof_description?.trim().length > 0 ? 40 : 0;
  const photoBonus = submission.photo_path ? 50 : 0;

  return basePoints + descriptionBonus + photoBonus;
}

export default function Challenges({ userId }) {
  const [activeFilter, setActiveFilter] = useState("TOUS");

  const [groups, setGroups] = useState([]);
  const [customChallenges, setCustomChallenges] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [groupRoles, setGroupRoles] = useState({});

  // Missions publiques
  const [publicCompletions, setPublicCompletions] = useState([]);
  const [loadingPublicCompletions, setLoadingPublicCompletions] =
    useState(true);
  const [checkingPublic, setCheckingPublic] = useState(null);
  const [checkingAllPublic, setCheckingAllPublic] = useState(false);

  // Création de défi
  const [showForm, setShowForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardPoints, setRewardPoints] = useState("60");

  // Preuve de réalisation
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [proofDescription, setProofDescription] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");

  // Chargements et actions
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [busySubmission, setBusySubmission] = useState(null);
  const [deletingChallenge, setDeletingChallenge] = useState(null);
  const [message, setMessage] = useState("");

  // =====================================================
  // MISSIONS PUBLIQUES
  // =====================================================

  async function refreshPublicCompletions() {
    if (!userId) {
      setPublicCompletions([]);
      setLoadingPublicCompletions(false);
      return;
    }

    setLoadingPublicCompletions(true);

    try {
      const { data, error } = await supabase
        .from("public_challenge_completions")
        .select("challenge_key, completed_at, points, group_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Erreur chargement missions publiques :", error);
        return;
      }

      setPublicCompletions(data || []);
    } finally {
      setLoadingPublicCompletions(false);
    }
  }

  useEffect(() => {
    refreshPublicCompletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function checkPublicChallenge(
    challengeKey,
    groupId = selectedGroup,
    silent = false
  ) {
    if (!userId || !groupId) {
      if (!silent) {
        setMessage("Tu dois rejoindre un groupe pour vérifier cette mission.");
      }
      return;
    }

    setCheckingPublic(challengeKey);

    try {
      const { data, error } = await supabase.rpc(
        "complete_public_challenge",
        {
          p_challenge_key: challengeKey,
          p_group_id: groupId,
        }
      );

      if (error) {
        console.error("Erreur vérification mission :", error);

        if (!silent) {
          setMessage(
            "Impossible de vérifier la mission : " + error.message
          );
        }

        return;
      }

      await refreshPublicCompletions();

      if (silent) return;

      if (data?.status === "completed") {
        if (Number(data.points_awarded) > 0) {
          setMessage(
            `Mission validée ! Tu remportes ${data.points_awarded} XP.`
          );
        } else {
          setMessage(
            "Mission validée ! La récompense avait déjà été attribuée."
          );
        }
      } else if (data?.status === "already_completed") {
        setMessage("Cette mission a déjà été validée.");
      } else if (data?.status === "not_eligible") {
        setMessage(
          "Mission non validée pour le moment. Continue tes activités et réessaie."
        );
      } else {
        setMessage("La vérification de la mission est terminée.");
      }
    } catch (error) {
      console.error("Erreur inattendue :", error);

      if (!silent) {
        setMessage("Une erreur est survenue pendant la vérification.");
      }
    } finally {
      setCheckingPublic(null);
    }
  }

  async function checkAllPublicChallenges(groupId = selectedGroup) {
    if (!userId || !groupId || checkingAllPublic) return;

    setCheckingAllPublic(true);

    let hasError = false;

    try {
      for (const challenge of initialChallenges) {
        const { error } = await supabase.rpc(
          "complete_public_challenge",
          {
            p_challenge_key: challenge.challengeKey,
            p_group_id: groupId,
          }
        );

        if (error) {
          console.error(
            `Erreur mission ${challenge.challengeKey} :`,
            error
          );
          hasError = true;
        }
      }

      await refreshPublicCompletions();

      if (hasError) {
        setMessage(
          "Certaines missions n'ont pas pu être vérifiées. Réessaie."
        );
      }
    } catch (error) {
      console.error("Erreur vérification globale :", error);
      setMessage("Impossible de vérifier toutes les missions.");
    } finally {
      setCheckingAllPublic(false);
    }
  }

  useEffect(() => {
    if (!loadingGroups && selectedGroup && userId) {
      checkAllPublicChallenges(selectedGroup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingGroups, selectedGroup, userId]);

  // =====================================================
  // CHARGEMENT DES GROUPES
  // =====================================================

  useEffect(() => {
    async function loadGroups() {
      if (!userId) {
        setGroups([]);
        setSelectedGroup("");
        setLoadingGroups(false);
        return;
      }

      setLoadingGroups(true);

      const { data: memberships, error: membershipError } = await supabase
        .from("group_members")
        .select("group_id, role")
        .eq("user_id", userId);

      if (membershipError) {
        console.error("Erreur récupération groupes :", membershipError);
        setMessage("Impossible de récupérer tes groupes.");
        setGroups([]);
        setLoadingGroups(false);
        return;
      }

      const roles = {};

      (memberships || []).forEach((membership) => {
        roles[membership.group_id] = membership.role;
      });

      setGroupRoles(roles);

      const groupIds = [
        ...new Set((memberships || []).map((item) => item.group_id)),
      ];

      if (groupIds.length === 0) {
        setGroups([]);
        setSelectedGroup("");
        setLoadingGroups(false);
        return;
      }

      const { data: loadedGroups, error: groupsError } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds);

      if (groupsError) {
        console.error("Erreur chargement groupes :", groupsError);
        setGroups([]);
      } else {
        setGroups(loadedGroups || []);

        if (loadedGroups?.length > 0) {
          setSelectedGroup((previous) =>
            loadedGroups.some((group) => group.id === previous)
              ? previous
              : loadedGroups[0].id
          );
        } else {
          setSelectedGroup("");
        }
      }

      setLoadingGroups(false);
    }

    loadGroups();
  }, [userId]);

  // =====================================================
  // CHARGEMENT DES DÉFIS PERSONNALISÉS
  // =====================================================

  useEffect(() => {
    async function loadCustomChallenges() {
      if (!userId) {
        setCustomChallenges([]);
        setLoadingChallenges(false);
        return;
      }

      setLoadingChallenges(true);

      const { data: memberships, error: membershipError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

      if (membershipError) {
        console.error("Erreur récupération groupes :", membershipError);
        setLoadingChallenges(false);
        return;
      }

      const groupIds = [
        ...new Set((memberships || []).map((item) => item.group_id)),
      ];

      if (groupIds.length === 0) {
        setCustomChallenges([]);
        setLoadingChallenges(false);
        return;
      }

      const { data, error } = await supabase
        .from("group_challenges")
        .select("*")
        .in("group_id", groupIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur chargement défis :", error);
        setMessage("Impossible de récupérer les défis enregistrés.");
        setLoadingChallenges(false);
        return;
      }

      const formattedChallenges = (data || []).map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        xp: Number(challenge.points) || 0,
        category: "Groupe",
        icon: Target,
        difficulty: "PERSONNALISÉ",
        groupId: challenge.group_id,
        createdBy: challenge.created_by,
      }));

      setCustomChallenges(formattedChallenges);
      setLoadingChallenges(false);
    }

    loadCustomChallenges();
  }, [userId]);

  // =====================================================
  // CHARGEMENT DES DEMANDES DE VALIDATION
  // =====================================================

  async function loadSubmissions() {
    if (!userId || customChallenges.length === 0) {
      setSubmissions([]);
      setMemberNames({});
      setLoadingSubmissions(false);
      return;
    }

    setLoadingSubmissions(true);

    const challengeIds = customChallenges.map((challenge) => challenge.id);

    const { data, error } = await supabase
      .from("group_challenge_submissions")
      .select("*")
      .in("challenge_id", challengeIds)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement demandes :", error);
      setMessage("Impossible de charger les demandes de validation.");
      setLoadingSubmissions(false);
      return;
    }

    const loadedSubmissions = await Promise.all(
      (data || []).map(async (submission) => {
        if (!submission.photo_path) return submission;

        const { data: signedData, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(submission.photo_path, 3600);

        if (signedError) {
          console.error("Erreur URL photo :", signedError);
          return submission;
        }

        return {
          ...submission,
          photoUrl: signedData?.signedUrl || "",
        };
      })
    );

    setSubmissions(loadedSubmissions);

    const userIds = [
      ...new Set(loadedSubmissions.map((item) => item.user_id)),
    ];

    if (userIds.length === 0) {
      setMemberNames({});
      setLoadingSubmissions(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    if (profilesError) {
      console.error("Erreur chargement pseudonymes :", profilesError);
    } else {
      const names = {};

      (profiles || []).forEach((profile) => {
        names[profile.id] = profile.username || "Membre";
      });

      setMemberNames(names);
    }

    setLoadingSubmissions(false);
  }

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, customChallenges]);

  // =====================================================
  // CRÉATION D'UN DÉFI PERSONNALISÉ
  // =====================================================

  async function createChallenge(e) {
    e.preventDefault();
    setMessage("");

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const xp = Number(rewardPoints);

    if (!selectedGroup || !cleanTitle || !cleanDescription) {
      setMessage("Merci de remplir tous les champs.");
      return;
    }

    if (!Number.isInteger(xp) || xp < 0 || xp > 1000) {
      setMessage("La récompense doit être comprise entre 0 et 1000 XP.");
      return;
    }

    if (cleanTitle.toLowerCase() === "organise un défi collectif") {
      setMessage("Ce titre est réservé au défi public.");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase
      .from("group_challenges")
      .insert({
        group_id: selectedGroup,
        title: cleanTitle,
        description: cleanDescription,
        points: xp,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    setCreating(false);

    if (error) {
      console.error("Erreur création défi :", error);
      setMessage("Impossible de créer le défi : " + error.message);
      return;
    }

    const newChallenge = {
      id: data.id,
      title: data.title,
      description: data.description,
      xp: Number(data.points) || 0,
      category: "Groupe",
      icon: Target,
      difficulty: "PERSONNALISÉ",
      groupId: data.group_id,
      createdBy: data.created_by,
    };

    setCustomChallenges((previous) => [
      newChallenge,
      ...previous.filter((challenge) => challenge.id !== data.id),
    ]);

    setTitle("");
    setDescription("");
    setRewardPoints("60");
    setShowForm(false);

    await checkPublicChallenge("create_group_challenge", selectedGroup, true);

    setMessage("Défi créé avec succès !");
  }

  // =====================================================
  // SUPPRESSION D'UN DÉFI PERSONNALISÉ
  // =====================================================

  async function deleteChallenge(challenge) {
    const confirmed = window.confirm(
      `Supprimer définitivement le défi « ${challenge.title} » ? Cette action est irréversible.`
    );

    if (!confirmed) return;

    setDeletingChallenge(challenge.id);
    setMessage("");

    const { error } = await supabase
      .from("group_challenges")
      .delete()
      .eq("id", challenge.id);

    if (error) {
      console.error("Erreur suppression défi :", error);
      setMessage(
        "Impossible de supprimer ce défi. Vérifie tes autorisations ou les demandes qui lui sont associées. " +
          error.message
      );
      setDeletingChallenge(null);
      return;
    }

    setCustomChallenges((previous) =>
      previous.filter((item) => item.id !== challenge.id)
    );

    setSubmissions((previous) =>
      previous.filter((item) => item.challenge_id !== challenge.id)
    );

    if (activeChallenge?.id === challenge.id) {
      closeProofForm();
    }

    setMessage("Défi supprimé avec succès.");
    setDeletingChallenge(null);
  }

  // =====================================================
  // FORMULAIRE DE PREUVE
  // =====================================================

  function openProofForm(challenge) {
    setActiveChallenge(challenge);
    setProofDescription("");
    setProofFile(null);
    setProofPreview("");
    setMessage("");
  }

  function closeProofForm() {
    if (submittingProof) return;

    if (proofPreview) {
      URL.revokeObjectURL(proofPreview);
    }

    setActiveChallenge(null);
    setProofDescription("");
    setProofFile(null);
    setProofPreview("");
  }

  function handleProofFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Format accepté : JPG, PNG ou WebP.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setMessage("La photo ne doit pas dépasser 5 Mo.");
      e.target.value = "";
      return;
    }

    if (proofPreview) {
      URL.revokeObjectURL(proofPreview);
    }

    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setMessage("");
  }

  // =====================================================
  // ENVOI D'UNE DEMANDE DE VALIDATION
  // =====================================================

  async function submitChallenge(e) {
    e.preventDefault();

    if (!userId || !activeChallenge?.groupId) return;

    const cleanProof = proofDescription.trim();

    if (cleanProof.length > 2000) {
      setMessage("La description ne doit pas dépasser 2000 caractères.");
      return;
    }

    setSubmittingProof(true);
    setMessage("");

    let uploadedPath = null;

    try {
      if (proofFile) {
        const extension =
          proofFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${crypto.randomUUID()}.${extension}`;

        uploadedPath = `${activeChallenge.groupId}/${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(uploadedPath, proofFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: proofFile.type,
          });

        if (uploadError) {
          throw new Error(
            "Impossible d'envoyer la photo : " + uploadError.message
          );
        }
      }

      const { error } = await supabase
        .from("group_challenge_submissions")
        .insert({
          challenge_id: activeChallenge.id,
          user_id: userId,
          status: "pending",
          proof_description: cleanProof || null,
          photo_path: uploadedPath,
        });

      if (error) {
        throw new Error(
          "Impossible d'envoyer la demande : " + error.message
        );
      }

      setMessage("Demande envoyée ! Un autre membre pourra la valider.");

      if (proofPreview) {
        URL.revokeObjectURL(proofPreview);
      }

      setActiveChallenge(null);
      setProofDescription("");
      setProofFile(null);
      setProofPreview("");

      await loadSubmissions();
    } catch (error) {
      console.error("Erreur envoi preuve :", error);

      if (uploadedPath) {
        const { error: removeError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([uploadedPath]);

        if (removeError) {
          console.error(
            "Erreur suppression photo temporaire :",
            removeError
          );
        }
      }

      setMessage(error.message || "Une erreur est survenue.");
    }

    setSubmittingProof(false);
  }

  // =====================================================
  // VALIDATION OU REFUS D'UNE DEMANDE
  // =====================================================

  async function reviewSubmission(submissionId, approved) {
    setBusySubmission(submissionId);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "review_group_challenge_submission",
      {
        p_submission_id: submissionId,
        p_approved: approved,
      }
    );

    if (error) {
      console.error("Erreur validation :", error);
      setMessage("Impossible de traiter la demande : " + error.message);
    } else {
      setMessage(
        data === "approved"
          ? "Défi validé ! Les XP ont été attribués."
          : "Demande refusée."
      );

      await loadSubmissions();
    }

    setBusySubmission(null);
  }

  // =====================================================
  // DONNÉES POUR L'AFFICHAGE
  // =====================================================

  const allChallenges = [...initialChallenges, ...customChallenges];

  const completedPublicKeys = new Set(
    publicCompletions.map((item) => item.challenge_key)
  );

  const completedCustomIds = new Set(
    submissions
      .filter(
        (item) =>
          item.user_id === userId &&
          item.status === "approved"
      )
      .map((item) => item.challenge_id)
  );

  // Retirer les missions déjà terminées
  const availableChallenges = allChallenges.filter((challenge) => {
    if (challenge.challengeKey) {
      return !completedPublicKeys.has(challenge.challengeKey);
    }

    return !completedCustomIds.has(challenge.id);
  });

  // Filtrage par catégorie
  const filteredChallenges =
    activeFilter === "TOUS"
      ? availableChallenges
      : availableChallenges.filter(
          (challenge) =>
            challenge.category.toUpperCase() === activeFilter
        );

  const totalXP = availableChallenges.reduce(
    (total, challenge) => total + challenge.xp,
    0
  );

  const pendingSubmissions = submissions.filter(
    (item) => item.status === "pending" && item.user_id !== userId
  );

  const completedPublicCount = publicCompletions.filter((completion) =>
    initialChallenges.some(
      (challenge) => challenge.challengeKey === completion.challenge_key
    )
  ).length;

  // =====================================================
  // AFFICHAGE
  // =====================================================

  return (
    <div className="challenges-page">
      <div className="challenges-header">
        <div>
          <div className="challenges-eyebrow">
            <Zap size={15} />
            <span>MISSIONS & RÉCOMPENSES</span>
          </div>

          <h1>
            LES <span>CHALLENGES.</span>
          </h1>

          <p>
            Relève des défis, participe à la vie du groupe
            et fais grimper ton expérience.
          </p>
        </div>

        <div className="challenges-header-icon">
          <Trophy size={42} />
        </div>
      </div>

      <div className="challenges-stats">
        <div className="challenge-stat-card">
          <div className="challenge-stat-icon">
            <Target size={20} />
          </div>
          <div>
            <strong>{availableChallenges.length}</strong>
            <span>DÉFIS DISPONIBLES</span>
          </div>
        </div>

        <div className="challenge-stat-card">
          <div className="challenge-stat-icon">
            <Zap size={20} />
          </div>
          <div>
            <strong>{totalXP} XP</strong>
            <span>XP DE BASE À GAGNER</span>
          </div>
        </div>

        <div className="challenge-stat-card">
          <div className="challenge-stat-icon">
            <CalendarDays size={20} />
          </div>
          <div>
            <strong>
              {submissions.filter((item) => item.status === "pending").length}
            </strong>
            <span>DEMANDES EN ATTENTE</span>
          </div>
        </div>
      </div>

      {/* Création de défi classique */}
      <div className="challenge-create-section">
        <button
          className="challenge-create-button"
          onClick={() => {
            setShowForm(!showForm);
            setMessage("");
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "FERMER" : "CRÉER UN DÉFI"}
        </button>

        {showForm && (
          <form className="challenge-create-form" onSubmit={createChallenge}>
            <h2>NOUVEAU DÉFI</h2>
            <p>Tout membre d'un groupe peut proposer un défi.</p>

            {loadingGroups ? (
              <p>Chargement des groupes...</p>
            ) : groups.length === 0 ? (
              <p>Tu dois rejoindre un groupe pour créer un défi.</p>
            ) : (
              <>
                <label>GROUPE</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  required
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>

                <label>TITRE DU DÉFI</label>
                <input
                  type="text"
                  placeholder="Ex : Organiser une activité..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  required
                />

                <label>DESCRIPTION</label>
                <textarea
                  placeholder="Explique les objectifs du défi..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  required
                />

                <label>RÉCOMPENSE EN XP</label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="1"
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(e.target.value)}
                  required
                />

                <p className="challenge-reward-explanation">
                  La récompense choisie est attribuée après validation.
                  Une description de preuve rapporte +40 XP et une photo
                  rapporte +50 XP.
                </p>

                <button
                  type="submit"
                  className="challenge-submit-button"
                  disabled={creating || loadingGroups}
                >
                  {creating ? (
                    <LoaderCircle size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                  {creating ? "CRÉATION..." : "PUBLIER LE DÉFI"}
                </button>
              </>
            )}

            {message && (
              <p className="challenge-create-message">{message}</p>
            )}
          </form>
        )}

        {!showForm && message && (
          <p className="challenge-create-message">{message}</p>
        )}
      </div>

      {/* Demandes à valider */}
      <div className="challenges-section-heading">
        <div>
          <h2>DEMANDES À VALIDER</h2>
          <p>Examine les preuves des autres membres de ton groupe.</p>
        </div>
      </div>

      <div className="challenge-submissions">
        {loadingSubmissions ? (
          <div className="challenges-loading">
            <LoaderCircle size={22} />
            <p>Chargement des demandes...</p>
          </div>
        ) : pendingSubmissions.length === 0 ? (
          <div className="challenges-loading">
            <Clock size={22} />
            <p>Aucune demande à valider pour le moment.</p>
          </div>
        ) : (
          pendingSubmissions.map((submission) => {
            const challenge = customChallenges.find(
              (item) => item.id === submission.challenge_id
            );

            if (!challenge) return null;

            return (
              <div className="challenge-submission-card" key={submission.id}>
                <div className="challenge-submission-info">
                  <strong>{challenge.title}</strong>

                  <span>
                    Demande de{" "}
                    <strong className="challenge-member-name">
                      {memberNames[submission.user_id] || "Membre"}
                    </strong>
                  </span>

                  {submission.proof_description && (
                    <div className="challenge-proof-description">
                      <FileText size={15} />
                      <span>{submission.proof_description}</span>
                    </div>
                  )}

                  {submission.photoUrl && (
                    <img
                      src={submission.photoUrl}
                      alt="Preuve du défi"
                      className="challenge-proof-image"
                    />
                  )}

                  <span>
                    Récompense potentielle :{" "}
                    <strong>
                      +{getSubmissionPoints(challenge, submission)} XP
                    </strong>
                  </span>
                </div>

                <div className="challenge-submission-actions">
                  <button
                    type="button"
                    className="challenge-approve-button"
                    disabled={busySubmission === submission.id}
                    onClick={() => reviewSubmission(submission.id, true)}
                  >
                    {busySubmission === submission.id ? (
                      <LoaderCircle size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                    Accepter
                  </button>

                  <button
                    type="button"
                    className="challenge-reject-button"
                    disabled={busySubmission === submission.id}
                    onClick={() => reviewSubmission(submission.id, false)}
                  >
                    <XCircle size={16} />
                    Refuser
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Missions publiques */}
      <div className="challenges-section-heading">
        <div>
          <h2>MISSIONS PUBLIQUES</h2>
          <p>
            {completedPublicCount}/6 missions accomplies. Les récompenses
            sont attribuées automatiquement.
          </p>
        </div>

        <button
          type="button"
          className="challenge-request-button"
          onClick={() => checkAllPublicChallenges()}
          disabled={
            loadingGroups ||
            !selectedGroup ||
            checkingAllPublic ||
            Boolean(checkingPublic)
          }
        >
          {checkingAllPublic ? (
            <LoaderCircle size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {checkingAllPublic ? "VÉRIFICATION..." : "ACTUALISER"}
        </button>
      </div>

      {/* Liste des défis encore disponibles */}
      <div className="challenges-section-heading">
        <div>
          <h2>TOUS LES DÉFIS</h2>
          <p>Choisis tes prochaines missions.</p>
        </div>

        <span className="challenge-count">
          {loadingPublicCompletions || checkingAllPublic
            ? "CHARGEMENT..."
            : `${filteredChallenges.length} MISSIONS`}
        </span>
      </div>

      <div className="challenges-filters">
        {filters.map((filter) => (
          <button
            key={filter}
            className={activeFilter === filter ? "active" : ""}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="challenges-grid">
        {loadingChallenges ||
        loadingSubmissions ||
        loadingPublicCompletions ||
        checkingAllPublic ? (
          <div className="challenges-loading">
            <LoaderCircle size={22} />
            <p>Chargement des défis...</p>
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="challenges-loading">
            <Target size={25} />
            <p>
              Aucun défi disponible dans cette catégorie. Bravo, tu as tout
              accompli !
            </p>
          </div>
        ) : (
          filteredChallenges.map((challenge) => {
            const Icon = challenge.icon;
            const isCustom = Boolean(challenge.groupId);

            const mySubmission = submissions.find(
              (item) =>
                item.challenge_id === challenge.id &&
                item.user_id === userId
            );

            const pendingForOthers = submissions.filter(
              (item) =>
                item.challenge_id === challenge.id &&
                item.status === "pending" &&
                item.user_id !== userId
            );

            return (
              <div className="challenge-card" key={challenge.id}>
                <div className="challenge-card-top">
                  <div className="challenge-icon">
                    <Icon size={23} />
                  </div>

                  <div className="challenge-card-top-actions">
                    <span
                      className={`challenge-difficulty ${challenge.difficulty.toLowerCase()}`}
                    >
                      {challenge.difficulty}
                    </span>

                    {isCustom &&
                      (challenge.createdBy === userId ||
                        ["admin", "owner", "creator"].includes(
                          String(
                            groupRoles[challenge.groupId] || ""
                          ).toLowerCase()
                        )) && (
                        <button
                          type="button"
                          className="challenge-delete-button"
                          onClick={() => deleteChallenge(challenge)}
                          disabled={deletingChallenge === challenge.id}
                          title="Supprimer ce défi"
                          aria-label={`Supprimer le défi ${challenge.title}`}
                        >
                          {deletingChallenge === challenge.id ? (
                            <LoaderCircle size={16} />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      )}
                  </div>
                </div>

                <div className="challenge-card-content">
                  <span className="challenge-category">
                    {challenge.category}
                  </span>

                  <h3>{challenge.title}</h3>
                  <p>{challenge.description}</p>
                </div>

                <div className="challenge-card-footer">
                  <div className="challenge-reward">
                    <Zap size={17} />
                    <strong>+{challenge.xp} XP</strong>
                  </div>

                  {!isCustom ? (
                    <button
                      type="button"
                      className="challenge-request-button"
                      disabled={
                        !selectedGroup ||
                        checkingAllPublic ||
                        checkingPublic === challenge.challengeKey
                      }
                      onClick={() =>
                        checkPublicChallenge(challenge.challengeKey)
                      }
                    >
                      {checkingPublic === challenge.challengeKey ? (
                        <LoaderCircle size={15} />
                      ) : !selectedGroup ? (
                        <Lock size={15} />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      {!selectedGroup ? "REJOINS UN GROUPE" : "VÉRIFIER"}
                    </button>
                  ) : mySubmission?.status === "pending" ? (
                    <span className="challenge-status-pending">
                      <Clock size={15} />
                      EN ATTENTE
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="challenge-request-button"
                      disabled={
                        Boolean(activeChallenge) ||
                        Boolean(busySubmission)
                      }
                      onClick={() => openProofForm(challenge)}
                    >
                      <CheckCircle2 size={15} />
                      {mySubmission?.status === "rejected"
                        ? "RÉESSAYER"
                        : "J'AI RÉUSSI"}
                    </button>
                  )}
                </div>

                {mySubmission?.status === "rejected" && (
                  <div className="challenge-status-rejected">
                    <XCircle size={14} />
                    Ta dernière demande a été refusée.
                  </div>
                )}

                {pendingForOthers.length > 0 && (
                  <div className="challenge-pending-count">
                    <Clock size={14} />
                    {pendingForOthers.length} demande(s) à examiner
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Formulaire de preuve */}
      {activeChallenge && (
        <div className="challenge-modal-overlay">
          <form className="challenge-proof-modal" onSubmit={submitChallenge}>
            <button
              type="button"
              className="challenge-modal-close"
              onClick={closeProofForm}
              disabled={submittingProof}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <div className="challenges-eyebrow">
              <CheckCircle2 size={15} />
              <span>VALIDATION DU DÉFI</span>
            </div>

            <h2>{activeChallenge.title}</h2>
            <p>{activeChallenge.description}</p>

            <div className="challenge-proof-reward">
              <Zap size={18} />
              <strong>{activeChallenge.xp} XP de base</strong>
            </div>

            <label htmlFor="proof-description">
              DESCRIPTION DE LA PREUVE <span>(+40 XP)</span>
            </label>

            <textarea
              id="proof-description"
              value={proofDescription}
              onChange={(e) => setProofDescription(e.target.value)}
              placeholder="Explique brièvement comment tu as réalisé le défi..."
              maxLength={2000}
              rows={4}
            />

            <div className="challenge-proof-character-count">
              {proofDescription.length}/2000 caractères
            </div>

            <label htmlFor="proof-photo">
              PHOTO DE PREUVE <span>(+50 XP)</span>
            </label>

            <label className="challenge-photo-upload" htmlFor="proof-photo">
              <ImagePlus size={22} />
              <span>
                {proofFile ? proofFile.name : "Ajouter une photo"}
              </span>
              <small>JPG, PNG ou WebP · 5 Mo maximum</small>
            </label>

            <input
              id="proof-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleProofFile}
              hidden
            />

            {proofPreview && (
              <div className="challenge-proof-preview">
                <img src={proofPreview} alt="Aperçu de la preuve" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(proofPreview);
                    setProofPreview("");
                    setProofFile(null);
                  }}
                  disabled={submittingProof}
                >
                  <X size={15} />
                  Retirer la photo
                </button>
              </div>
            )}

            <p className="challenge-proof-notice">
              Partage uniquement une preuve adaptée au groupe. Respecte
              la vie privée et le consentement des personnes concernées.
            </p>

            {message && (
              <p className="challenge-create-message">{message}</p>
            )}

            <button
              type="submit"
              className="challenge-submit-button"
              disabled={submittingProof}
            >
              {submittingProof ? (
                <LoaderCircle size={17} />
              ) : (
                <CheckCircle2 size={17} />
              )}
              {submittingProof ? "ENVOI..." : "ENVOYER MA DEMANDE"}
            </button>
          </form>
        </div>
      )}

      <div className="challenges-info">
        <CheckCircle2 size={19} />
        <p>
          Les défis personnalisés peuvent être créés par tous les membres
          de leur groupe. Leur validation par un autre membre permet
          d'attribuer les XP. Une description et une photo de preuve
          apportent des bonus. Les missions publiques sont vérifiées
          automatiquement et leurs récompenses ne peuvent être obtenues
          qu'une seule fois.
        </p>
      </div>
    </div>
  );
}
