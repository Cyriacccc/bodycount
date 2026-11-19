
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
    description:
      "Propose une activité à réaliser avec les membres de ton groupe.",
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
    description:
      "Personnalise à nouveau ton profil après l'avoir complété.",
    xp: 40,
    category: "Profil",
    icon: Star,
    difficulty: "FACILE",
  },
];

// Normalisation des titres pour éviter les différences de casse
// ou d'espacement lors de la comparaison.
function normalizeChallengeTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Titres des missions prédéfinies à ne jamais afficher
// dans l'onglet Défis publics.
const BASE_CHALLENGE_TITLES = new Set([
  ...initialChallenges.map((challenge) =>
    normalizeChallengeTitle(challenge.title)
  ),

  // Anciens intitulés éventuellement présents en base.
  "lance une discussion",
  "rejoins un groupe",
]);

function getSubmissionPoints(challenge, submission) {
  const basePoints = Number(challenge.xp) || 0;

  const descriptionBonus =
    submission.proof_description?.trim().length > 0 ? 40 : 0;

  const photoBonus = submission.photo_path ? 50 : 0;

  return basePoints + descriptionBonus + photoBonus;
}

export default function Challenges({ userId }) {
  // Navigation entre les deux catégories
  const [activeTab, setActiveTab] = useState("personal");

  // Groupes
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupRoles, setGroupRoles] = useState({});

  // Défis publics créés par les membres
  const [customChallenges, setCustomChallenges] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [memberNames, setMemberNames] = useState({});

  // Progression des défis personnels
  const [personalCompletions, setPersonalCompletions] = useState([]);
  const [loadingPersonalCompletions, setLoadingPersonalCompletions] =
    useState(true);
  const [checkingPublic, setCheckingPublic] = useState(null);
  const [checkingAllPublic, setCheckingAllPublic] = useState(false);

  // Création d'un défi public
  const [showForm, setShowForm] = useState(false);
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
  // CHARGEMENT DES DÉFIS PERSONNELS TERMINÉS
  // =====================================================

  async function refreshPersonalCompletions() {
    if (!userId) {
      setPersonalCompletions([]);
      setLoadingPersonalCompletions(false);
      return;
    }

    setLoadingPersonalCompletions(true);

    try {
      const { data, error } = await supabase
        .from("public_challenge_completions")
        .select("challenge_key, completed_at, points, group_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Erreur chargement défis personnels :", error);
        setMessage("Impossible de charger ta progression personnelle.");
        return;
      }

      setPersonalCompletions(data || []);
    } finally {
      setLoadingPersonalCompletions(false);
    }
  }

  useEffect(() => {
    refreshPersonalCompletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // =====================================================
  // VÉRIFICATION D'UN DÉFI PERSONNEL
  // =====================================================

  async function checkPersonalChallenge(
    challengeKey,
    groupId = selectedGroup
  ) {
    if (!userId || !groupId) {
      setMessage("Tu dois rejoindre un groupe pour vérifier ce défi.");
      return;
    }

    setCheckingPublic(challengeKey);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "complete_public_challenge",
        {
          p_challenge_key: challengeKey,
          p_group_id: groupId,
        }
      );

      if (error) {
        console.error("Erreur vérification défi personnel :", error);
        setMessage("Impossible de vérifier le défi : " + error.message);
        return;
      }

      await refreshPersonalCompletions();

      if (data?.status === "completed") {
        if (Number(data.points_awarded) > 0) {
          setMessage(
            `Défi validé ! Tu remportes ${data.points_awarded} XP.`
          );
        } else {
          setMessage(
            "Défi validé ! La récompense avait déjà été attribuée."
          );
        }
      } else if (data?.status === "already_completed") {
        setMessage("Ce défi a déjà été validé.");
      } else if (data?.status === "not_eligible") {
        setMessage(
          "Tu ne remplis pas encore les conditions. Continue tes activités et réessaie."
        );
      } else {
        setMessage("La vérification du défi est terminée.");
      }
    } catch (error) {
      console.error("Erreur inattendue :", error);
      setMessage("Une erreur est survenue pendant la vérification.");
    } finally {
      setCheckingPublic(null);
    }
  }

  // =====================================================
  // VÉRIFICATION AUTOMATIQUE DES DÉFIS PERSONNELS
  // =====================================================

  async function checkAllPersonalChallenges(groupId = selectedGroup) {
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
            `Erreur défi ${challenge.challengeKey} :`,
            error
          );

          hasError = true;
        }
      }

      await refreshPersonalCompletions();

      if (hasError) {
        setMessage(
          "Certains défis n'ont pas pu être vérifiés. Réessaie."
        );
      }
    } catch (error) {
      console.error("Erreur vérification globale :", error);
      setMessage("Impossible de vérifier tous les défis.");
    } finally {
      setCheckingAllPublic(false);
    }
  }

  useEffect(() => {
    if (!loadingGroups && selectedGroup && userId) {
      checkAllPersonalChallenges(selectedGroup);
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
        setSelectedGroup("");
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
        setSelectedGroup("");
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
  // CHARGEMENT DES DÉFIS PUBLICS CRÉÉS PAR LES MEMBRES
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
        setMessage("Impossible de récupérer les groupes.");
        setCustomChallenges([]);
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
        .not("created_by", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur chargement défis publics :", error);
        setMessage("Impossible de récupérer les défis enregistrés.");
        setCustomChallenges([]);
        setLoadingChallenges(false);
        return;
      }

      // Double filtre :
      // 1. Le défi doit avoir été créé par un membre.
      // 2. Son titre ne doit pas correspondre à une mission prédéfinie.
      const formattedChallenges = (data || [])
        .filter((challenge) => {
          const normalizedTitle = normalizeChallengeTitle(
            challenge.title
          );

          return (
            Boolean(challenge.created_by) &&
            !BASE_CHALLENGE_TITLES.has(normalizedTitle)
          );
        })
        .map((challenge) => ({
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          xp: Number(challenge.points) || 0,
          category: "Public",
          icon: Target,
          difficulty: "PUBLIC",
          groupId: challenge.group_id,
          createdBy: challenge.created_by,
        }));

      setCustomChallenges(formattedChallenges);
      setLoadingChallenges(false);
    }

    loadCustomChallenges();
  }, [userId]);

  // =====================================================
  // CHARGEMENT DES PARTICIPATIONS AUX DÉFIS PUBLICS
  // =====================================================

  async function loadSubmissions() {
    if (!userId || customChallenges.length === 0) {
      setSubmissions([]);
      setMemberNames({});
      setLoadingSubmissions(false);
      return;
    }

    setLoadingSubmissions(true);

    const challengeIds = customChallenges.map(
      (challenge) => challenge.id
    );

    const { data, error } = await supabase
      .from("group_challenge_submissions")
      .select("*")
      .in("challenge_id", challengeIds)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement participations :", error);
      setMessage("Impossible de charger les demandes de validation.");
      setLoadingSubmissions(false);
      return;
    }

    const loadedSubmissions = await Promise.all(
      (data || []).map(async (submission) => {
        if (!submission.photo_path) return submission;

        const { data: signedData, error: signedError } =
          await supabase.storage
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
  // CRÉATION D'UN DÉFI PUBLIC
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

    if (
      BASE_CHALLENGE_TITLES.has(normalizeChallengeTitle(cleanTitle))
    ) {
      setMessage(
        "Ce titre est réservé à une mission prédéfinie. Choisis un autre titre."
      );
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
      category: "Public",
      icon: Target,
      difficulty: "PUBLIC",
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

    await checkPersonalChallenge(
      "create_group_challenge",
      selectedGroup
    );

    setMessage("Défi public créé avec succès !");
  }

  // =====================================================
  // SUPPRESSION D'UN DÉFI PUBLIC
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
        "Impossible de supprimer ce défi. Vérifie tes autorisations. " +
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
  // ENVOI D'UNE PARTICIPATION
  // =====================================================

  async function submitChallenge(e) {
    e.preventDefault();

    if (!userId || !activeChallenge?.groupId) return;

    const cleanProof = proofDescription.trim();

    if (!cleanProof && !proofFile) {
      setMessage(
        "Ajoute une description ou une photo pour présenter ta preuve."
      );
      return;
    }

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
          "Impossible d'envoyer la participation : " + error.message
        );
      }

      setMessage(
        "Participation envoyée ! Un autre membre pourra la valider."
      );

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
    } finally {
      setSubmittingProof(false);
    }
  }

  // =====================================================
  // VALIDATION OU REFUS D'UNE PARTICIPATION
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
          : "Participation refusée."
      );

      await loadSubmissions();
    }

    setBusySubmission(null);
  }

  // =====================================================
  // DONNÉES CALCULÉES
  // =====================================================

  const completedPersonalKeys = new Set(
    personalCompletions.map((item) => item.challenge_key)
  );

  const availablePersonalChallenges = initialChallenges.filter(
    (challenge) =>
      !completedPersonalKeys.has(challenge.challengeKey)
  );

  const selectedGroupName =
    groups.find((group) => group.id === selectedGroup)?.name || "";

  const selectedGroupChallenges = customChallenges.filter(
    (challenge) => challenge.groupId === selectedGroup
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

  const availablePublicChallenges = selectedGroupChallenges.filter(
    (challenge) => !completedCustomIds.has(challenge.id)
  );

  const pendingSubmissions = submissions.filter((submission) => {
    const challenge = selectedGroupChallenges.find(
      (item) => item.id === submission.challenge_id
    );

    return (
      challenge &&
      submission.status === "pending" &&
      submission.user_id !== userId
    );
  });

  const personalXPAvailable = availablePersonalChallenges.reduce(
    (total, challenge) => total + challenge.xp,
    0
  );

  const publicXPAvailable = availablePublicChallenges.reduce(
    (total, challenge) => total + challenge.xp,
    0
  );

  const completedPersonalCount = personalCompletions.filter(
    (completion) =>
      initialChallenges.some(
        (challenge) =>
          challenge.challengeKey === completion.challenge_key
      )
  ).length;

  const personalLoading =
    loadingGroups ||
    loadingPersonalCompletions ||
    checkingAllPublic;

  const publicLoading =
    loadingGroups ||
    loadingChallenges ||
    loadingSubmissions;

  // =====================================================
  // AFFICHAGE
  // =====================================================

  return (
    <div className="challenges-page">
      {/* EN-TÊTE */}
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

      {/* STATISTIQUES */}
      <div className="challenges-stats">
        <div className="challenge-stat-card">
          <div className="challenge-stat-icon">
            <UserRound size={20} />
          </div>

          <div>
            <strong>{completedPersonalCount}/6</strong>
            <span>DÉFIS PERSO TERMINÉS</span>
          </div>
        </div>

        <div className="challenge-stat-card">
          <div className="challenge-stat-icon">
            <Zap size={20} />
          </div>

          <div>
            <strong>
              {activeTab === "personal"
                ? `${personalXPAvailable} XP`
                : `${publicXPAvailable} XP`}
            </strong>
            <span>XP DISPONIBLES</span>
          </div>
        </div>

        <div className="challenge-stat-card">
          <div className="challenge-stat-icon">
            <CalendarDays size={20} />
          </div>

          <div>
            <strong>{pendingSubmissions.length}</strong>
            <span>DEMANDES À VALIDER</span>
          </div>
        </div>
      </div>

      {/* DEUX ONGLETS PRINCIPAUX */}
      <div className="challenge-tabs">
        <button
          type="button"
          className={`challenge-tab ${
            activeTab === "personal" ? "active" : ""
          }`}
          onClick={() => {
            setActiveTab("personal");
            setMessage("");
          }}
        >
          <UserRound size={18} />
          <span>DÉFIS PERSO</span>
          <small>{availablePersonalChallenges.length}</small>
        </button>

        <button
          type="button"
          className={`challenge-tab ${
            activeTab === "public" ? "active" : ""
          }`}
          onClick={() => {
            setActiveTab("public");
            setMessage("");
          }}
        >
          <Users size={18} />
          <span>DÉFIS PUBLICS</span>
          <small>{selectedGroupChallenges.length}</small>
        </button>
      </div>

      {/* MESSAGE GLOBAL */}
      {message && !activeChallenge && (
        <p className="challenge-create-message">{message}</p>
      )}

      {/* ================================================= */}
      {/* ONGLET DÉFIS PERSONNELS */}
      {/* ================================================= */}

      {activeTab === "personal" && (
        <section className="challenge-tab-content">
          <div className="challenges-section-heading">
            <div>
              <h2>TES DÉFIS PERSONNELS</h2>
              <p>
                Ces défis sont individuels. Ta progression n'est visible
                que par toi.
              </p>
            </div>

            <span className="challenge-count">
              {completedPersonalCount}/6 TERMINÉS
            </span>
          </div>

          {/* Groupe nécessaire pour le contexte de vérification RPC */}
          {!loadingGroups && groups.length > 0 && (
            <div className="challenge-group-selector">
              <label htmlFor="personal-group-select">
                GROUPE DE RÉFÉRENCE
              </label>

              <select
                id="personal-group-select"
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  setMessage("");
                }}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>

              <p>
                Ce groupe sert uniquement de contexte pour vérifier tes
                défis. Ta progression personnelle reste indépendante du groupe.
              </p>
            </div>
          )}

          <div className="challenges-section-heading">
            <div>
              <h2>MISSIONS INDIVIDUELLES</h2>
              <p>
                Les récompenses sont attribuées automatiquement lorsque
                les conditions sont remplies.
              </p>
            </div>

            <button
              type="button"
              className="challenge-request-button"
              onClick={() => checkAllPersonalChallenges()}
              disabled={
                !selectedGroup ||
                personalLoading ||
                Boolean(checkingPublic)
              }
            >
              {checkingAllPublic ? (
                <LoaderCircle size={15} />
              ) : (
                <CheckCircle2 size={15} />
              )}

              {checkingAllPublic
                ? "VÉRIFICATION..."
                : "ACTUALISER"}
            </button>
          </div>

          <div className="challenges-grid">
            {personalLoading ? (
              <div className="challenges-loading">
                <LoaderCircle size={22} />
                <p>Chargement de tes défis personnels...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="challenges-loading">
                <Lock size={25} />
                <p>
                  Rejoins un groupe pour pouvoir vérifier et valider tes
                  défis personnels.
                </p>
              </div>
            ) : availablePersonalChallenges.length === 0 ? (
              <div className="challenges-loading">
                <Trophy size={25} />
                <p>
                  Bravo ! Tu as terminé tous tes défis personnels.
                  Retrouve tes réussites dans l'onglet Réussites.
                </p>
              </div>
            ) : (
              availablePersonalChallenges.map((challenge) => {
                const Icon = challenge.icon;

                return (
                  <div className="challenge-card" key={challenge.id}>
                    <div className="challenge-card-top">
                      <div className="challenge-icon">
                        <Icon size={23} />
                      </div>

                      <span
                        className={`challenge-difficulty ${challenge.difficulty.toLowerCase()}`}
                      >
                        {challenge.difficulty}
                      </span>
                    </div>

                    <div className="challenge-card-content">
                      <span className="challenge-category">
                        DÉFI PERSONNEL
                      </span>

                      <h3>{challenge.title}</h3>
                      <p>{challenge.description}</p>
                    </div>

                    <div className="challenge-card-footer">
                      <div className="challenge-reward">
                        <Zap size={17} />
                        <strong>+{challenge.xp} XP</strong>
                      </div>

                      <button
                        type="button"
                        className="challenge-request-button"
                        disabled={
                          checkingAllPublic ||
                          checkingPublic === challenge.challengeKey
                        }
                        onClick={() =>
                          checkPersonalChallenge(challenge.challengeKey)
                        }
                      >
                        {checkingPublic === challenge.challengeKey ? (
                          <LoaderCircle size={15} />
                        ) : (
                          <CheckCircle2 size={15} />
                        )}

                        VÉRIFIER
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="challenges-info">
            <Lock size={19} />
            <p>
              Les défis personnels sont propres à ton compte. Leur progression
              et leurs récompenses ne dépendent pas de celles des autres
              membres du groupe.
            </p>
          </div>
        </section>
      )}

      {/* ================================================= */}
      {/* ONGLET DÉFIS PUBLICS */}
      {/* ================================================= */}

      {activeTab === "public" && (
        <section className="challenge-tab-content">
          <div className="challenges-section-heading">
            <div>
              <h2>LES DÉFIS DE TON GROUPE</h2>
              <p>
                Tous les membres du groupe peuvent participer aux mêmes défis.
              </p>
            </div>
          </div>

          {loadingGroups ? (
            <div className="challenges-loading">
              <LoaderCircle size={22} />
              <p>Chargement de tes groupes...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="challenges-loading">
              <Users size={25} />
              <p>
                Tu dois rejoindre un groupe pour découvrir et créer des
                défis publics.
              </p>
            </div>
          ) : (
            <>
              {/* SÉLECTION DU GROUPE */}
              <div className="challenge-group-selector">
                <label htmlFor="public-group-select">GROUPE</label>

                <select
                  id="public-group-select"
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    setMessage("");
                    setShowForm(false);
                  }}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>

                <p>
                  Tu consultes les défis publics de{" "}
                  <strong>{selectedGroupName}</strong>. Les défis des autres
                  groupes ne sont pas affichés ici.
                </p>
              </div>

              {/* CRÉATION D'UN DÉFI PUBLIC */}
              <div className="challenge-create-section">
                <button
                  type="button"
                  className="challenge-create-button"
                  onClick={() => {
                    setShowForm(!showForm);
                    setMessage("");
                  }}
                >
                  {showForm ? <X size={18} /> : <Plus size={18} />}
                  {showForm ? "FERMER" : "CRÉER UN DÉFI PUBLIC"}
                </button>

                {showForm && (
                  <form
                    className="challenge-create-form"
                    onSubmit={createChallenge}
                  >
                    <h2>NOUVEAU DÉFI PUBLIC</h2>

                    <p>
                      Propose un défi auquel tous les membres de{" "}
                      {selectedGroupName} pourront participer.
                    </p>

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
                      disabled={creating}
                    >
                      {creating ? (
                        <LoaderCircle size={17} />
                      ) : (
                        <Plus size={17} />
                      )}

                      {creating ? "CRÉATION..." : "PUBLIER LE DÉFI"}
                    </button>

                    {message && (
                      <p className="challenge-create-message">{message}</p>
                    )}
                  </form>
                )}
              </div>

              {/* DEMANDES À VALIDER */}
              <div className="challenges-section-heading">
                <div>
                  <h2>DEMANDES À VALIDER</h2>
                  <p>
                    Examine les preuves envoyées par les autres membres
                    de ce groupe.
                  </p>
                </div>

                <span className="challenge-count">
                  {pendingSubmissions.length} EN ATTENTE
                </span>
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
                    const challenge = selectedGroupChallenges.find(
                      (item) => item.id === submission.challenge_id
                    );

                    if (!challenge) return null;

                    return (
                      <div
                        className="challenge-submission-card"
                        key={submission.id}
                      >
                        <div className="challenge-submission-info">
                          <strong>{challenge.title}</strong>

                          <span>
                            Participation de{" "}
                            <strong className="challenge-member-name">
                              {memberNames[submission.user_id] || "Membre"}
                            </strong>
                          </span>

                          {submission.proof_description && (
                            <div className="challenge-proof-description">
                              <FileText size={15} />
                              <span>
                                {submission.proof_description}
                              </span>
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
                            onClick={() =>
                              reviewSubmission(submission.id, true)
                            }
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
                            onClick={() =>
                              reviewSubmission(submission.id, false)
                            }
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

              {/* LISTE DES DÉFIS PUBLICS */}
              <div className="challenges-section-heading">
                <div>
                  <h2>DÉFIS PUBLICS</h2>
                  <p>
                    Participe aux défis proposés par les membres de ton groupe.
                  </p>
                </div>

                <span className="challenge-count">
                  {publicLoading
                    ? "CHARGEMENT..."
                    : `${availablePublicChallenges.length} DÉFIS`}
                </span>
              </div>

              <div className="challenges-grid">
                {publicLoading ? (
                  <div className="challenges-loading">
                    <LoaderCircle size={22} />
                    <p>Chargement des défis publics...</p>
                  </div>
                ) : selectedGroupChallenges.length === 0 ? (
                  <div className="challenges-loading">
                    <Target size={25} />
                    <p>
                      Aucun défi public pour le moment. Sois le premier à en
                      proposer un à ton groupe !
                    </p>
                  </div>
                ) : availablePublicChallenges.length === 0 ? (
                  <div className="challenges-loading">
                    <Trophy size={25} />
                    <p>
                      Tu as participé à tous les défis publics disponibles
                      de ce groupe. Retrouve tes réussites dans l'onglet
                      Réussites.
                    </p>
                  </div>
                ) : (
                  availablePublicChallenges.map((challenge) => {
                    const Icon = challenge.icon;

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

                    const canDelete =
                      challenge.createdBy === userId ||
                      ["admin", "owner", "creator"].includes(
                        String(
                          groupRoles[challenge.groupId] || ""
                        ).toLowerCase()
                      );

                    return (
                      <div className="challenge-card" key={challenge.id}>
                        <div className="challenge-card-top">
                          <div className="challenge-icon">
                            <Icon size={23} />
                          </div>

                          <div className="challenge-card-top-actions">
                            <span className="challenge-difficulty public">
                              PUBLIC
                            </span>

                            {canDelete && (
                              <button
                                type="button"
                                className="challenge-delete-button"
                                onClick={() => deleteChallenge(challenge)}
                                disabled={
                                  deletingChallenge === challenge.id
                                }
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
                            DÉFI DE GROUPE
                          </span>

                          <h3>{challenge.title}</h3>
                          <p>{challenge.description}</p>
                        </div>

                        <div className="challenge-card-footer">
                          <div className="challenge-reward">
                            <Zap size={17} />
                            <strong>+{challenge.xp} XP</strong>
                          </div>

                          {mySubmission?.status === "pending" ? (
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
                            Ta dernière participation a été refusée.
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

              <div className="challenges-info">
                <Users size={19} />
                <p>
                  Les défis publics sont communs aux membres de leur groupe.
                  Chaque membre peut participer individuellement en envoyant
                  une preuve. Un autre membre peut ensuite valider ou refuser
                  cette participation. Les récompenses sont attribuées au
                  participant concerné.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ================================================= */}
      {/* MODALE DE PREUVE */}
      {/* ================================================= */}

      {activeChallenge && (
        <div className="challenge-modal-overlay">
          <form
            className="challenge-proof-modal"
            onSubmit={submitChallenge}
          >
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
              <span>PARTICIPATION AU DÉFI</span>
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

            <label
              className="challenge-photo-upload"
              htmlFor="proof-photo"
            >
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

              {submittingProof
                ? "ENVOI..."
                : "ENVOYER MA PARTICIPATION"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
