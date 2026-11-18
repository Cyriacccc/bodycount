
import { useEffect, useRef, useState } from "react";
import {
  Heart,
  ShieldCheck,
  Users,
  Plus,
  X,
  LoaderCircle,
  Trash2,
  Flag,
  Sparkles,
  ImagePlus,
  Upload,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const categories = [
  { value: "category_1", label: "Catégorie 1" },
  { value: "category_2", label: "Catégorie 2" },
  { value: "category_3", label: "Catégorie 3" },
];

const reactionsList = [
  { value: "fire", label: "🔥" },
  { value: "respect", label: "👏" },
  { value: "funny", label: "😂" },
  { value: "star", label: "⭐" },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function Experiences({ userId }) {
  const fileInputRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [reactions, setReactions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingExperiences, setLoadingExperiences] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("category_1");
  const [description, setDescription] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [charterAccepted, setCharterAccepted] = useState(false);

  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    loadGroups();
  }, [userId]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData();
    }
  }, [selectedGroup]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  async function loadGroups() {
    setLoading(true);
    setError("");

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (membershipError) {
      setError("Impossible de récupérer tes groupes.");
      setLoading(false);
      return;
    }

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setSelectedGroup("");
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((item) => item.group_id);

    const { data, error: groupsError } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (groupsError) {
      setError("Impossible de charger les groupes.");
    } else {
      setGroups(data || []);
      if (data?.length > 0) {
        setSelectedGroup(data[0].id);
      }
    }

    setLoading(false);
  }

  async function loadProfiles(userIds) {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);

    if (uniqueIds.length === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar")
      .in("id", uniqueIds);

    if (error) {
      console.error("Erreur profils :", error);
      return;
    }

    setProfiles((previous) => {
      const updated = { ...previous };

      (data || []).forEach((profile) => {
        updated[profile.id] = profile;
      });

      return updated;
    });
  }

  async function loadGroupData() {
    setLoadingExperiences(true);
    setError("");
    setSuccess("");

    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select(
        "experiences_adult_confirmed_at, experiences_charter_accepted_at"
      )
      .eq("group_id", selectedGroup)
      .eq("user_id", userId)
      .single();

    if (membershipError) {
      setError("Impossible de vérifier ton accès à cette fonctionnalité.");
      setLoadingExperiences(false);
      return;
    }

    setConsentAccepted(
      Boolean(
        membership?.experiences_adult_confirmed_at &&
        membership?.experiences_charter_accepted_at
      )
    );

    await loadGroupExperiences();
    setLoadingExperiences(false);
  }

  async function loadGroupExperiences() {
    const { data, error } = await supabase
      .from("group_experiences")
      .select("*")
      .eq("group_id", selectedGroup)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      setError("Impossible de charger les expériences.");
      setExperiences([]);
      setReactions([]);
      return;
    }

    const items = data || [];

    // Génération des URL temporaires pour les photos privées.
    const experiencesWithPhotos = await Promise.all(
      items.map(async (item) => {
        if (!item.photo_path) {
          return { ...item, photo_url: null };
        }

        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("group-experience-photos")
            .createSignedUrl(item.photo_path, 3600);

        if (signedError) {
          console.error("Erreur photo :", signedError);
          return { ...item, photo_url: null };
        }

        return {
          ...item,
          photo_url: signedData.signedUrl,
        };
      })
    );

    setExperiences(experiencesWithPhotos);

    if (items.length > 0) {
      const experienceIds = items.map((item) => item.id);

      const { data: reactionData, error: reactionError } = await supabase
        .from("experience_reactions")
        .select("*")
        .in("experience_id", experienceIds);

      if (reactionError) {
        setError("Impossible de charger les réactions.");
        setReactions([]);
      } else {
        setReactions(reactionData || []);
      }

      const userIds = [
        ...items.map((item) => item.user_id),
        ...(reactionData || []).map((item) => item.user_id),
      ];

      await loadProfiles(userIds);
    } else {
      setReactions([]);
    }
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    if (!allowedTypes.includes(file.type)) {
      setError("Format non accepté. Utilise JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("La photo ne doit pas dépasser 5 Mo.");
      event.target.value = "";
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoFile(null);

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoPreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function uploadPhoto() {
    if (!photoFile) return null;

    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = extensions[photoFile.type];

    if (!extension) {
      throw new Error("Format de photo non accepté.");
    }

    const fileName = `${crypto.randomUUID()}.${extension}`;
    const photoPath = `${selectedGroup}/${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from("group-experience-photos")
      .upload(photoPath, photoFile, {
        contentType: photoFile.type,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return photoPath;
  }

  async function publishExperience(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!adultConfirmed && !consentAccepted) {
      setError("Tu dois confirmer ta majorité.");
      return;
    }

    if (!charterAccepted && !consentAccepted) {
      setError("Tu dois accepter la charte.");
      return;
    }

    if (!description.trim()) {
      setError("Ajoute une description avant de publier.");
      return;
    }

    setPublishing(true);

    let uploadedPhotoPath = null;

    try {
      if (!consentAccepted) {
        const { error: consentError } = await supabase.rpc(
          "accept_experience_charter",
          {
            p_group_id: selectedGroup,
            p_is_18_plus: true,
          }
        );

        if (consentError) throw consentError;

        setConsentAccepted(true);
      }

      // Envoyer la photo si l'utilisateur en a sélectionné une.
      if (photoFile) {
        uploadedPhotoPath = await uploadPhoto();
      }

      const { error: publishError } = await supabase.rpc(
        "submit_group_experience",
        {
          p_group_id: selectedGroup,
          p_category: category,
          p_description: description.trim(),
          p_photo_path: uploadedPhotoPath,
        }
      );

      if (publishError) throw publishError;

      setDescription("");
      setCategory("category_1");
      removePhoto();

      setAdultConfirmed(false);
      setCharterAccepted(false);
      setShowForm(false);

      setSuccess("Ton expérience a été publiée.");

      await loadGroupExperiences();
    } catch (err) {
      console.error(err);

      // Nettoyer la photo si la publication a échoué.
      if (uploadedPhotoPath) {
        const { error: removeError } = await supabase.storage
          .from("group-experience-photos")
          .remove([uploadedPhotoPath]);

        if (removeError) {
          console.error("Erreur suppression photo temporaire :", removeError);
        }
      }

      setError(err.message || "Impossible de publier cette expérience.");
    } finally {
      setPublishing(false);
    }
  }

  async function addReaction(experienceId, reactionType) {
    setError("");

    const experience = experiences.find(
      (item) => item.id === experienceId
    );

    if (!experience || experience.user_id === userId) return;

    const alreadyReacted = reactions.some(
      (item) =>
        item.experience_id === experienceId &&
        item.user_id === userId
    );

    if (alreadyReacted) {
      setError("Tu as déjà réagi à cette publication.");
      return;
    }

    const { data, error } = await supabase
      .from("experience_reactions")
      .insert({
        experience_id: experienceId,
        user_id: userId,
        reaction_type: reactionType,
      })
      .select("*")
      .single();

    if (error) {
      setError(
        error.code === "23505"
          ? "Tu as déjà réagi à cette publication."
          : "Impossible d'ajouter ta réaction."
      );
      return;
    }

    setReactions((previous) => [...previous, data]);
  }

  async function deleteExperience(experienceId) {
    const experience = experiences.find(
      (item) => item.id === experienceId
    );

    if (!experience) return;

    const confirmed = window.confirm(
      "Supprimer définitivement cette publication ?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("group_experiences")
      .delete()
      .eq("id", experienceId)
      .eq("user_id", userId);

    if (error) {
      setError("Impossible de supprimer cette publication.");
      return;
    }

    // Supprimer également la photo associée.
    if (experience.photo_path) {
      const { error: photoError } = await supabase.storage
        .from("group-experience-photos")
        .remove([experience.photo_path]);

      if (photoError) {
        console.error("Erreur suppression photo :", photoError);
      }
    }

    setExperiences((previous) =>
      previous.filter((item) => item.id !== experienceId)
    );

    setReactions((previous) =>
      previous.filter((item) => item.experience_id !== experienceId)
    );

    setSuccess("Publication supprimée.");
  }

  async function reportExperience(event, experienceId) {
    event.preventDefault();
    setError("");

    if (reportReason.trim().length < 3) {
      setError("Explique brièvement pourquoi tu signales cette publication.");
      return;
    }

    const { error } = await supabase
      .from("experience_reports")
      .insert({
        experience_id: experienceId,
        reported_by: userId,
        reason: reportReason.trim(),
      });

    if (error) {
      setError(
        error.code === "23505"
          ? "Tu as déjà signalé cette publication."
          : "Impossible d'envoyer le signalement."
      );
      return;
    }

    setReportingId(null);
    setReportReason("");
    setSuccess("Signalement envoyé. Merci.");
  }

  function formatDate(date) {
    return new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCategoryLabel(value) {
    return categories.find((item) => item.value === value)?.label || value;
  }

  function getReactionCount(experienceId, reactionType) {
    return reactions.filter(
      (item) =>
        item.experience_id === experienceId &&
        item.reaction_type === reactionType
    ).length;
  }

  function hasReacted(experienceId) {
    return reactions.some(
      (item) =>
        item.experience_id === experienceId &&
        item.user_id === userId
    );
  }

  if (loading) {
    return (
      <div className="experiences-loading">
        <LoaderCircle className="spin" size={24} />
        <p>Chargement de tes groupes...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="experiences-empty">
        <Users size={40} />
        <h2>Aucun groupe</h2>
        <p>Rejoins un groupe pour accéder aux expériences.</p>
      </div>
    );
  }

  return (
    <div className="experiences-page">
      <div className="experiences-header">
        <div>
          <span className="section-eyebrow">ESPACE PRIVÉ</span>
          <h1>Expériences</h1>
          <p>Un espace de partage volontaire entre membres du groupe.</p>
        </div>

        <select
          className="experiences-group-select"
          value={selectedGroup}
          onChange={(event) => setSelectedGroup(event.target.value)}
          aria-label="Choisir un groupe"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="experiences-privacy">
        <ShieldCheck size={21} />
        <div>
          <strong>Un espace réservé aux adultes du groupe</strong>
          <p>
            Les publications sont visibles uniquement par les membres
            autorisés du groupe. Le partage reste entièrement volontaire.
          </p>
        </div>
      </div>

      {error && <div className="experiences-error">{error}</div>}
      {success && <div className="experiences-success">{success}</div>}

      <div className="experiences-toolbar">
        <div>
          <h2>Publications</h2>
          <span>{experiences.length} expérience(s)</span>
        </div>

        <button
          className="experiences-new-button"
          onClick={() => {
            setShowForm((previous) => !previous);
            setError("");
            setSuccess("");
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Fermer" : "Partager"}
        </button>
      </div>

      {showForm && (
        <form className="experience-form" onSubmit={publishExperience}>
          <div className="experience-form-heading">
            <Sparkles size={20} />
            <h2>Partager une expérience</h2>
          </div>

          {!consentAccepted && (
            <div className="experience-consent">
              <h3>Avant de publier</h3>

              <label>
                <input
                  type="checkbox"
                  checked={adultConfirmed}
                  onChange={(event) =>
                    setAdultConfirmed(event.target.checked)
                  }
                />
                Je confirme avoir 18 ans ou plus.
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={charterAccepted}
                  onChange={(event) =>
                    setCharterAccepted(event.target.checked)
                  }
                />
                J'accepte la charte : je partage uniquement mes propres
                expériences, sans révéler l'identité d'une autre personne
                ni publier de contenu intime ou de photo intime.
              </label>
            </div>
          )}

          <label className="experience-field-label">
            Catégorie
          </label>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="experience-input"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <label className="experience-field-label">
            Description
          </label>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Raconte ton expérience..."
            maxLength={2000}
            rows={5}
            required
          />

          <label className="experience-field-label">
            Photo <span>(facultatif)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectPhoto}
            hidden
          />

          {photoPreview ? (
            <div className="experience-photo-preview">
              <img src={photoPreview} alt="Aperçu de la photo" />

              <div className="experience-photo-controls">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Remplacer
                </button>

                <button type="button" onClick={removePhoto}>
                  <Trash2 size={16} />
                  Retirer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="experience-photo-upload"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={24} />
              <strong>Ajouter une photo</strong>
              <span>JPG, PNG ou WebP · 5 Mo maximum</span>
            </button>
          )}

          <div className="experience-form-footer">
            <span>{description.length}/2000 caractères</span>

            <button type="submit" disabled={publishing}>
              {publishing ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Plus size={18} />
              )}
              {publishing ? "Publication..." : "Publier"}
            </button>
          </div>

          <p className="experience-form-note">
            Ne publie aucune photo intime ni image permettant d'identifier
            une autre personne sans son autorisation explicite.
          </p>
        </form>
      )}

      {loadingExperiences ? (
        <div className="experiences-loading">
          <LoaderCircle className="spin" size={24} />
          <p>Chargement des publications...</p>
        </div>
      ) : experiences.length === 0 ? (
        <div className="experiences-no-items">
          <Heart size={38} />
          <h2>Aucune expérience pour le moment</h2>
          <p>
            Les membres peuvent partager volontairement leurs expériences
            dans cet espace privé.
          </p>
        </div>
      ) : (
        <div className="experiences-list">
          {experiences.map((experience) => {
            const author = profiles[experience.user_id];
            const mine = experience.user_id === userId;
            const reacted = hasReacted(experience.id);

            return (
              <article className="experience-card" key={experience.id}>
                <div className="experience-card-header">
                  <div className="experience-author">
                    <span className="experience-avatar">
                      {author?.avatar || "👤"}
                    </span>

                    <div>
                      <strong>
                        {mine ? "Toi" : author?.username || "Membre"}
                      </strong>
                      <small>{formatDate(experience.created_at)}</small>
                    </div>
                  </div>

                  <span className="experience-category">
                    {getCategoryLabel(experience.category)}
                  </span>
                </div>

                <p className="experience-description">
                  {experience.description}
                </p>

                {experience.photo_url && (
                  <div className="experience-photo">
                    <img
                      src={experience.photo_url}
                      alt="Photo de la publication"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="experience-card-footer">
                  <div className="experience-reactions">
                    {reactionsList.map((reaction) => {
                      const count = getReactionCount(
                        experience.id,
                        reaction.value
                      );

                      return (
                        <button
                          key={reaction.value}
                          type="button"
                          className={
                            reacted
                              ? "experience-reaction reacted"
                              : "experience-reaction"
                          }
                          onClick={() =>
                            addReaction(experience.id, reaction.value)
                          }
                          disabled={mine || reacted}
                          title={
                            mine
                              ? "Tu ne peux pas réagir à ta publication"
                              : reacted
                              ? "Tu as déjà réagi"
                              : "Réagir"
                          }
                        >
                          <span>{reaction.label}</span>
                          {count > 0 && <small>{count}</small>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="experience-actions">
                    {mine ? (
                      <button
                        type="button"
                        onClick={() => deleteExperience(experience.id)}
                        title="Supprimer"
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReportingId(
                            reportingId === experience.id
                              ? null
                              : experience.id
                          );
                          setReportReason("");
                        }}
                        title="Signaler"
                      >
                        <Flag size={17} />
                      </button>
                    )}
                  </div>
                </div>

                {reportingId === experience.id && (
                  <form
                    className="experience-report-form"
                    onSubmit={(event) =>
                      reportExperience(event, experience.id)
                    }
                  >
                    <label>
                      Pourquoi souhaites-tu signaler cette publication ?
                    </label>

                    <textarea
                      value={reportReason}
                      onChange={(event) =>
                        setReportReason(event.target.value)
                      }
                      placeholder="Explique le problème..."
                      maxLength={500}
                      rows={3}
                      required
                    />

                    <div>
                      <button
                        type="button"
                        onClick={() => setReportingId(null)}
                      >
                        Annuler
                      </button>

                      <button type="submit">
                        Envoyer le signalement
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
