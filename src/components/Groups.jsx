
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Crown,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";

function formatDate(date) {
  if (!date) return "Date inconnue";

  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Groups({ userId }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const notify = (message, type = "success") => {
    if (type === "error") {
      setError(message);
      setSuccess("");
    } else {
      setSuccess(message);
      setError("");
    }
  };

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id, role, joined_at")
      .eq("user_id", userId);

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((item) => item.group_id);

    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .select("id, name, invite_code, created_at")
      .in("id", groupIds);

    if (groupError) {
      setError(groupError.message);
      setLoading(false);
      return;
    }

    const { data: memberRows } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    const counts = (memberRows || []).reduce((acc, row) => {
      acc[row.group_id] = (acc[row.group_id] || 0) + 1;
      return acc;
    }, {});

    const formattedGroups = (groupData || []).map((group) => {
      const membership = memberships.find(
        (item) => item.group_id === group.id
      );

      return {
        ...group,
        role: membership?.role || "member",
        joined_at: membership?.joined_at,
        memberCount: counts[group.id] || 0,
      };
    });

    setGroups(formattedGroups);
    setLoading(false);
  }, [userId]);

  const loadMembers = useCallback(async (group) => {
    setDetailLoading(true);
    setError("");

    const { data: memberRows, error: memberError } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", group.id)
      .order("joined_at", { ascending: true });

    if (memberError) {
      setError(memberError.message);
      setDetailLoading(false);
      return;
    }

    const ids = (memberRows || []).map((member) => member.user_id);

    let profiles = [];

    if (ids.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", ids);

      if (profileError) {
        setError(profileError.message);
      } else {
        profiles = profileRows || [];
      }
    }

    const formattedMembers = (memberRows || []).map((member) => {
      const profile = profiles.find((item) => item.id === member.user_id);

      return {
        ...member,
        username: profile?.username || "MEMBER",
      };
    });

    setMembers(formattedMembers);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const openGroup = async (group) => {
    setSelectedGroup(group);
    await loadMembers(group);
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      notify("Code d'invitation copié !");
    } catch {
      notify("Impossible de copier le code.", "error");
    }
  };

  const createGroup = async (event) => {
    event.preventDefault();

    if (groupName.trim().length < 3) {
      notify("Le nom du groupe doit contenir au moins 3 caractères.", "error");
      return;
    }

    setSubmitting(true);

    const { error: createError } = await supabase.rpc("create_group", {
      group_name: groupName.trim(),
    });

    setSubmitting(false);

    if (createError) {
      notify(createError.message, "error");
      return;
    }

    setGroupName("");
    setShowCreate(false);
    notify("Groupe créé avec succès !");
    await loadGroups();
  };

  const joinGroup = async (event) => {
    event.preventDefault();

    if (!inviteCode.trim()) {
      notify("Entre un code d'invitation.", "error");
      return;
    }

    setSubmitting(true);

    const { error: joinError } = await supabase.rpc("join_group", {
      code: inviteCode.trim(),
    });

    setSubmitting(false);

    if (joinError) {
      notify(joinError.message, "error");
      return;
    }

    setInviteCode("");
    setShowJoin(false);
    notify("Tu as rejoint le groupe !");
    await loadGroups();
  };

  const leaveGroup = async (group) => {
    if (group.role === "admin") {
      notify(
        "Un administrateur ne peut pas quitter son groupe. Supprime-le ou transfère d'abord son administration.",
        "error"
      );
      return;
    }

    if (!window.confirm(`Quitter le groupe « ${group.name} » ?`)) return;

    const { error: leaveError } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", userId);

    if (leaveError) {
      notify(leaveError.message, "error");
      return;
    }

    setSelectedGroup(null);
    notify("Tu as quitté le groupe.");
    await loadGroups();
  };

  const deleteGroup = async (group) => {
    if (
      !window.confirm(
        `Supprimer définitivement le groupe « ${group.name} » et ses membres ?`
      )
    ) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("groups")
      .delete()
      .eq("id", group.id);

    if (deleteError) {
      notify(deleteError.message, "error");
      return;
    }

    setSelectedGroup(null);
    notify("Groupe supprimé.");
    await loadGroups();
  };

  const removeMember = async (member) => {
    if (member.user_id === userId) {
      notify("Tu ne peux pas te retirer toi-même depuis cette action.", "error");
      return;
    }

    if (
      !window.confirm(
        `Retirer ${member.username} du groupe ${selectedGroup.name} ?`
      )
    ) {
      return;
    }

    const { error: removeError } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", selectedGroup.id)
      .eq("user_id", member.user_id);

    if (removeError) {
      notify(removeError.message, "error");
      return;
    }

    notify(`${member.username} a été retiré du groupe.`);
    await loadMembers(selectedGroup);
    await loadGroups();
  };

  const refresh = async () => {
    if (selectedGroup) {
      await loadMembers(selectedGroup);
    } else {
      await loadGroups();
    }
  };

  return (
    <div className="gc-page">
      {error && (
        <div className="gc-notice gc-error">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="gc-notice gc-success">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
      )}

      {!selectedGroup ? (
        <>
          <div className="gc-header">
            <div>
              <div className="gc-eyebrow">ESPACE COMMUNAUTAIRE</div>
              <h1>Mes groupes</h1>
              <p>Retrouve tes groupes et leurs membres.</p>
            </div>

            <button className="gc-refresh" onClick={refresh} title="Actualiser">
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="gc-actions">
            <button
              className="gc-primary"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={18} />
              Créer un groupe
            </button>

            <button
              className="gc-secondary"
              onClick={() => setShowJoin(true)}
            >
              <KeyRound size={17} />
              Rejoindre un groupe
            </button>
          </div>

          {loading ? (
            <div className="gc-empty">
              <RefreshCw className="gc-spin" size={25} />
              <p>Chargement des groupes...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="gc-empty">
              <div className="gc-empty-icon">
                <Users size={30} />
              </div>
              <h3>Aucun groupe pour le moment</h3>
              <p>
                Crée ton premier groupe ou rejoins un groupe avec un code
                d'invitation.
              </p>
            </div>
          ) : (
            <div className="gc-grid">
              {groups.map((group) => (
                <div className="gc-card" key={group.id}>
                  <div className="gc-card-top">
                    <div className="gc-group-icon">
                      <Users size={21} />
                    </div>

                    <span
                      className={`gc-role ${
                        group.role === "admin" ? "gc-admin" : ""
                      }`}
                    >
                      {group.role === "admin" ? (
                        <>
                          <Crown size={13} /> ADMIN
                        </>
                      ) : (
                        "MEMBRE"
                      )}
                    </span>
                  </div>

                  <h3>{group.name}</h3>

                  <div className="gc-card-meta">
                    <span>
                      <Users size={15} />
                      {group.memberCount} membre
                      {group.memberCount > 1 ? "s" : ""}
                    </span>
                    <span>
                      <CalendarDays size={15} />
                      {formatDate(group.created_at)}
                    </span>
                  </div>

                  <div className="gc-invite">
                    <div>
                      <small>CODE D'INVITATION</small>
                      <strong>{group.invite_code}</strong>
                    </div>
                    <button
                      onClick={() => copyCode(group.invite_code)}
                      title="Copier le code"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <button
                    className="gc-open"
                    onClick={() => openGroup(group)}
                  >
                    Ouvrir le groupe
                    <span>→</span>
                  </button>

                  <div className="gc-card-footer">
                    {group.role === "admin" ? (
                      <button
                        className="gc-danger-link"
                        onClick={() => deleteGroup(group)}
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    ) : (
                      <button
                        className="gc-danger-link"
                        onClick={() => leaveGroup(group)}
                      >
                        <LogOut size={14} />
                        Quitter
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="gc-detail-header">
            <button
              className="gc-back"
              onClick={() => {
                setSelectedGroup(null);
                setMembers([]);
                setError("");
                setSuccess("");
                loadGroups();
              }}
            >
              <ArrowLeft size={17} />
              Retour aux groupes
            </button>

            <button className="gc-refresh" onClick={refresh} title="Actualiser">
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="gc-detail-title">
            <div className="gc-group-icon gc-large-icon">
              <Users size={27} />
            </div>
            <div>
              <div className="gc-eyebrow">ESPACE PRIVÉ</div>
              <h1>{selectedGroup.name}</h1>
              <p>
                Créé le {formatDate(selectedGroup.created_at)}
              </p>
            </div>
          </div>

          <div className="gc-detail-stats">
            <div className="gc-stat">
              <Users size={19} />
              <div>
                <strong>{members.length}</strong>
                <span>Membres</span>
              </div>
            </div>

            <div className="gc-stat">
              <ShieldCheck size={19} />
              <div>
                <strong>
                  {selectedGroup.role === "admin" ? "Admin" : "Membre"}
                </strong>
                <span>Ton rôle</span>
              </div>
            </div>
          </div>

          <div className="gc-invite-detail">
            <div>
              <small>CODE D'INVITATION DU GROUPE</small>
              <strong>{selectedGroup.invite_code}</strong>
              <p>Partage ce code avec les personnes que tu souhaites inviter.</p>
            </div>
            <button
              className="gc-primary"
              onClick={() => copyCode(selectedGroup.invite_code)}
            >
              <Copy size={16} />
              Copier
            </button>
          </div>

          <div className="gc-section-heading">
            <div>
              <h2>Membres du groupe</h2>
              <p>Les profils visibles dans cet espace privé.</p>
            </div>
            <span>{members.length}</span>
          </div>

          {detailLoading ? (
            <div className="gc-empty">
              <RefreshCw className="gc-spin" size={24} />
              <p>Chargement des membres...</p>
            </div>
          ) : (
            <div className="gc-members">
              {members.map((member) => (
                <div className="gc-member" key={member.user_id}>
                  <div className="gc-avatar">
                    {member.username.charAt(0).toUpperCase()}
                  </div>

                  <div className="gc-member-info">
                    <strong>
                      {member.username}
                      {member.user_id === userId && (
                        <span className="gc-you">TOI</span>
                      )}
                    </strong>
                    <small>
                      Membre depuis {formatDate(member.joined_at)}
                    </small>
                  </div>

                  <div className="gc-member-actions">
                    {member.role === "admin" ? (
                      <span className="gc-role gc-admin">
                        <Crown size={13} />
                        ADMIN
                      </span>
                    ) : (
                      <span className="gc-role">MEMBRE</span>
                    )}

                    {selectedGroup.role === "admin" &&
                      member.user_id !== userId && (
                        <button
                          className="gc-remove"
                          title="Retirer ce membre"
                          onClick={() => removeMember(member)}
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="gc-ranking-placeholder">
            <div className="gc-ranking-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3>Espace classement</h3>
              <p>
                Cette section pourra accueillir des statistiques de jeu
                volontaires, choisies et renseignées par les membres.
              </p>
              <span>EN PRÉPARATION</span>
            </div>
          </div>

          <div className="gc-bottom-actions">
            {selectedGroup.role === "admin" ? (
              <button
                className="gc-danger-button"
                onClick={() => deleteGroup(selectedGroup)}
              >
                <Trash2 size={16} />
                Supprimer le groupe
              </button>
            ) : (
              <button
                className="gc-danger-button"
                onClick={() => leaveGroup(selectedGroup)}
              >
                <LogOut size={16} />
                Quitter le groupe
              </button>
            )}
          </div>
        </>
      )}

      {showCreate && (
        <div className="gc-overlay" onClick={() => setShowCreate(false)}>
          <form
            className="gc-modal"
            onSubmit={createGroup}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="gc-modal-close"
              onClick={() => setShowCreate(false)}
            >
              <X size={19} />
            </button>

            <div className="gc-modal-icon">
              <Plus size={23} />
            </div>
            <h2>Créer un groupe</h2>
            <p>Donne un nom à ton nouvel espace privé.</p>

            <label htmlFor="group-name">Nom du groupe</label>
            <input
              id="group-name"
              type="text"
              placeholder="Ex : Les amis"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              maxLength={40}
              autoFocus
            />

            <button
              type="submit"
              className="gc-primary gc-submit"
              disabled={submitting}
            >
              {submitting ? "Création..." : "Créer le groupe"}
            </button>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="gc-overlay" onClick={() => setShowJoin(false)}>
          <form
            className="gc-modal"
            onSubmit={joinGroup}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="gc-modal-close"
              onClick={() => setShowJoin(false)}
            >
              <X size={19} />
            </button>

            <div className="gc-modal-icon">
              <KeyRound size={23} />
            </div>
            <h2>Rejoindre un groupe</h2>
            <p>Entre le code d'invitation qui t'a été communiqué.</p>

            <label htmlFor="invite-code">Code d'invitation</label>
            <input
              id="invite-code"
              type="text"
              placeholder="Ex : ABC123"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              autoFocus
            />

            <button
              type="submit"
              className="gc-primary gc-submit"
              disabled={submitting}
            >
              {submitting ? "Connexion..." : "Rejoindre"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
