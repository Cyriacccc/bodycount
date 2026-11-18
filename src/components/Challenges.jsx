

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
    title: "Complète ton profil",
    description: "Choisis ton pseudonyme et personnalise ton avatar.",
    xp: 50,
    category: "Profil",
    icon: UserRound,
    difficulty: "FACILE",
  },
  {
    id: 2,
    title: "Rejoins un groupe",
    description: "Intègre un groupe et commence à participer.",
    xp: 25,
    category: "Social",
    icon: Users,
    difficulty: "FACILE",
  },
  {
    id: 3,
    title: "Lance une discussion",
    description: "Propose un sujet de discussion aux membres de ton groupe.",
    xp: 30,
    category: "Social",
    icon: MessageCircle,
    difficulty: "MOYEN",
  },
  {
    id: 4,
    title: "Organise un défi collectif",
    description: "Propose une activité à réaliser avec les membres de ton groupe.",
    xp: 75,
    category: "Groupe",
    icon: Target,
    difficulty: "DIFFICILE",
  },
  {
    id: 5,
    title: "Reste actif",
    description: "Participe à la vie de ton groupe plusieurs jours de suite.",
    xp: 100,
    category: "Régularité",
    icon: Flame,
    difficulty: "DIFFICILE",
  },
  {
    id: 6,
    title: "Fais évoluer ton profil",
    description: "Personnalise ton profil pour te démarquer.",
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

function formatValidationDate(date) {
  if (!date) return "Date inconnue";

  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function Challenges({ userId }) {
  const [activeFilter, setActiveFilter] = useState("TOUS");

  const [groups, setGroups] = useState([]);
  const [customChallenges, setCustomChallenges] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [groupRoles, setGroupRoles] = useState({});

  const [showForm, setShowForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardPoints, setRewardPoints] = useState("60");

  const [activeChallenge, setActiveChallenge] = useState(null);
  const [proofDescription, setProofDescription] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [busySubmission, setBusySubmission] = useState(null);
  const [deletingChallenge, setDeletingChallenge] = useState(null);
  const [message, setMessage] = useState("");

  // Charger tous les groupes dont l'utilisateur est membre
  useEffect(() => {
    async function loadGroups() {
      if (!userId) {
        setGroups([]);
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
        }
      }

      setLoadingGroups(false);
    }

    loadGroups();
  }, [userId]);

  // Charger les défis personnalisés de tous les groupes
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

  // Charger les demandes de validation et leurs photos
  async function loadSubmissions() {
    if (!userId || customChallenges.length === 0) {
      setSubmissions([]);
      setMemberNames({});
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

  // Créer un défi classique
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
    setMessage("Défi créé avec succès !");
  }

  // Supprimer un défi personnalisé
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

  // Ouvrir le formulaire de preuve
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

  // Sélectionner une photo de preuve
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

  // Envoyer une demande avec sa preuve facultative
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

  // Accepter ou refuser une demande
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

  const allChallenges = [...initialChallenges, ...customChallenges];

  const filteredChallenges =
    activeFilter === "TOUS"
      ? allChallenges
      : allChallenges.filter(
          (challenge) => challenge.category.toUpperCase() === activeFilter
        );

  const totalXP = allChallenges.reduce(
    (total, challenge) => total + challenge.xp,
    0
  );

  const approvedSubmissions = submissions
    .filter((item) => item.status === "approved")
    .sort(
      (a, b) =>
        new Date(b.reviewed_at || b.submitted_at) -
        new Date(a.reviewed_at || a.submitted_at)
    );

  const pendingSubmissions = submissions.filter(
    (item) => item.status === "pending" && item.user_id !== userId
  );

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
            <strong>{allChallenges.length}</strong>
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

      {/* Historique des défis validés */}
      <div className="challenges-section-heading">
        <div>
          <h2>HISTORIQUE DES DÉFIS</h2>
          <p>Retrouve les défis accomplis par les membres du groupe.</p>
        </div>

        <span className="challenge-count">
          {approvedSubmissions.length} VALIDÉS
        </span>
      </div>

      <div className="challenge-submissions">
        {approvedSubmissions.length === 0 ? (
          <div className="challenges-loading">
            <Trophy size={22} />
            <p>Aucun défi validé pour le moment.</p>
          </div>
        ) : (
          approvedSubmissions.map((submission) => {
            const challenge = customChallenges.find(
              (item) => item.id === submission.challenge_id
            );

            if (!challenge) return null;

            return (
              <div className="challenge-submission-card" key={submission.id}>
                <div className="challenge-submission-info">
                  <strong>{challenge.title}</strong>

                  <span>
                    Réalisé par{" "}
                    <strong className="challenge-member-name">
                      {memberNames[submission.user_id] || "Membre"}
                    </strong>
                  </span>

                  <span>
                    Validé le {formatValidationDate(submission.reviewed_at)}
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
                </div>

                <div className="challenge-reward">
                  <Zap size={17} />
                  <strong>
                    +{getSubmissionPoints(challenge, submission)} XP
                  </strong>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Liste des défis publics et classiques */}
      <div className="challenges-section-heading">
        <div>
          <h2>TOUS LES DÉFIS</h2>
          <p>Choisis tes prochaines missions.</p>
        </div>

        <span className="challenge-count">
          {filteredChallenges.length} MISSIONS
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
        {loadingChallenges ? (
          <div className="challenges-loading">
            <LoaderCircle size={22} />
            <p>Chargement des défis...</p>
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="challenges-loading">
            <Target size={25} />
            <p>Aucun défi dans cette catégorie pour le moment.</p>
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
                          String(groupRoles[challenge.groupId] || "").toLowerCase()
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
                    <span className="challenge-coming-soon">
                      <Lock size={13} />
                      BIENTÔT
                    </span>
                  ) : mySubmission?.status === "approved" ? (
                    <span className="challenge-status-approved">
                      <CheckCircle2 size={15} />
                      VALIDÉ
                    </span>
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
          apportent des bonus.
        </p>
      </div>
    </div>
  );
}
