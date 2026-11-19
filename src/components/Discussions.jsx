
import { useEffect, useState } from "react";
import {
  MessageCircle,
  Send,
  Plus,
  ArrowLeft,
  LoaderCircle,
  Users,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Discussions({ userId }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [discussions, setDiscussions] = useState([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    loadGroups();
  }, [userId]);

  useEffect(() => {
    if (selectedGroup) {
      loadDiscussions();
      setSelectedDiscussion(null);
      setMessages([]);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedDiscussion) {
      loadMessages(selectedDiscussion.id);
    }
  }, [selectedDiscussion]);

  async function loadGroups() {
    setLoading(true);
    setError("");

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id, role")
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

    const groupIds = memberships.map((membership) => membership.group_id);

    const { data, error: groupsError } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (groupsError) {
      setError("Impossible de charger les groupes.");
    } else {
      const groupsWithRole = (data || []).map((group) => ({
        ...group,
        role:
          memberships.find((membership) => membership.group_id === group.id)
            ?.role || "member",
      }));

      setGroups(groupsWithRole);
      if (groupsWithRole.length > 0) {
        setSelectedGroup(groupsWithRole[0].id);
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

  async function loadDiscussions() {
    setLoadingDiscussions(true);
    setError("");

    const { data, error } = await supabase
      .from("group_discussions")
      .select("*")
      .eq("group_id", selectedGroup)
      .order("created_at", { ascending: false });

    if (error) {
      setError("Impossible de charger les discussions.");
      setDiscussions([]);
    } else {
      setDiscussions(data || []);
      await loadProfiles((data || []).map((discussion) => discussion.created_by));
    }

    setLoadingDiscussions(false);
  }

  async function loadMessages(discussionId) {
    setLoadingMessages(true);
    setError("");

    const { data, error } = await supabase
      .from("discussion_messages")
      .select("*")
      .eq("discussion_id", discussionId)
      .order("created_at", { ascending: true });

    if (error) {
      setError("Impossible de charger les messages.");
      setMessages([]);
    } else {
      setMessages(data || []);
      await loadProfiles((data || []).map((message) => message.author_id));
    }

    setLoadingMessages(false);
  }

  async function createDiscussion(event) {
    event.preventDefault();
    setError("");

    if (!title.trim() || !content.trim()) {
      setError("Complète le titre et le contenu.");
      return;
    }

    const { data, error } = await supabase
      .from("group_discussions")
      .insert({
        group_id: selectedGroup,
        title: title.trim(),
        content: content.trim(),
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      setError("Impossible de créer la discussion : " + error.message);
      return;
    }

    setDiscussions((previous) => [data, ...previous]);
    await loadProfiles([userId]);
    setTitle("");
    setContent("");
    setShowForm(false);
    setSelectedDiscussion(data);
  }

  async function sendMessage(event) {
    event.preventDefault();
    setError("");

    if (!messageText.trim() || !selectedDiscussion) return;

    const { data, error } = await supabase
      .from("discussion_messages")
      .insert({
        discussion_id: selectedDiscussion.id,
        author_id: userId,
        content: messageText.trim(),
      })
      .select("*")
      .single();

    if (error) {
      setError("Impossible d'envoyer le message : " + error.message);
      return;
    }

    setMessages((previous) => [...previous, data]);
    await loadProfiles([userId]);
    setMessageText("");
  }

  async function deleteDiscussion(discussion) {
    if (!discussion) return;

    const confirmed = window.confirm(
      `Supprimer définitivement la discussion « ${discussion.title} » et tous ses messages ?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("group_discussions")
      .delete()
      .eq("id", discussion.id);

    if (error) {
      setError("Impossible de supprimer cette discussion : " + error.message);
      return;
    }

    setDiscussions((previous) =>
      previous.filter((item) => item.id !== discussion.id)
    );

    if (selectedDiscussion?.id === discussion.id) {
      setSelectedDiscussion(null);
      setMessages([]);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="discussions-loading">
        <LoaderCircle className="spin" size={24} />
        <p>Chargement des discussions...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="discussions-empty">
        <Users size={40} />
        <h2>Aucun groupe</h2>
        <p>Rejoins un groupe pour accéder aux discussions.</p>
      </div>
    );
  }

  return (
    <div className="discussions-page">
      <div className="discussions-header">
        <div>
          <span className="section-eyebrow">COMMUNAUTÉ</span>
          <h1>Discussions</h1>
          <p>Échange avec les membres de tes groupes.</p>
        </div>

        <select
          value={selectedGroup}
          onChange={(event) => setSelectedGroup(event.target.value)}
          aria-label="Choisir un groupe"
          className="discussions-group-select"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="discussions-error">{error}</div>}

      <div className="discussion-layout">
        <aside className={`discussion-sidebar ${selectedDiscussion ? "mobile-hidden" : ""}`}>
          <div className="discussion-sidebar-header">
            <div>
              <h2>Conversations</h2>
              <span>{discussions.length} discussion(s)</span>
            </div>

            <button
              className="discussion-new-button"
              onClick={() => setShowForm(!showForm)}
              title="Créer une discussion"
            >
              <Plus size={18} />
            </button>
          </div>

          {showForm && (
            <form className="discussion-form" onSubmit={createDiscussion}>
              <h3>Nouvelle discussion</h3>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Titre de la discussion"
                maxLength={100}
                required
              />

              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Lance le sujet..."
                maxLength={3000}
                rows={4}
                required
              />

              <button type="submit" className="discussion-submit-button">
                Créer la discussion
              </button>
            </form>
          )}

          {loadingDiscussions ? (
            <div className="discussion-loading-small">
              <LoaderCircle className="spin" size={20} />
            </div>
          ) : discussions.length === 0 ? (
            <div className="discussion-no-items">
              <MessageCircle size={28} />
              <p>Aucune discussion pour le moment.</p>
              <span>Sois le premier à lancer un sujet !</span>
            </div>
          ) : (
            <div className="discussion-list">
              {discussions.map((discussion) => {
                const author = profiles[discussion.created_by];

                return (
                  <button
                    key={discussion.id}
                    className={`discussion-card ${
                      selectedDiscussion?.id === discussion.id ? "active" : ""
                    }`}
                    onClick={() => setSelectedDiscussion(discussion)}
                  >
                    <div className="discussion-card-top">
                      <span>{author?.avatar || "👤"} {author?.username || "Membre"}</span>
                      <small>{formatDate(discussion.created_at)}</small>
                    </div>

                    <h3>{discussion.title}</h3>
                    <p>{discussion.content}</p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className={`discussion-detail ${!selectedDiscussion ? "mobile-hidden" : ""}`}>
          {selectedDiscussion ? (
            <>
              <div className="discussion-detail-header">
                <button
                  className="discussion-back-button"
                  onClick={() => setSelectedDiscussion(null)}
                  aria-label="Retour aux discussions"
                >
                  <ArrowLeft size={18} />
                </button>

                <div>
                  <span>SUJET DE DISCUSSION</span>
                  <h2>{selectedDiscussion.title}</h2>
                </div>

                {(selectedDiscussion.created_by === userId ||
                  groups.find((group) => group.id === selectedGroup)?.role ===
                    "admin") && (
                  <button
                    type="button"
                    className="discussion-delete-button"
                    onClick={() => deleteDiscussion(selectedDiscussion)}
                    title="Supprimer cette discussion"
                    aria-label="Supprimer cette discussion"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="discussion-original-post">
                <div className="discussion-author">
                  <span className="discussion-avatar">
                    {profiles[selectedDiscussion.created_by]?.avatar || "👤"}
                  </span>
                  <div>
                    <strong>
                      {profiles[selectedDiscussion.created_by]?.username || "Membre"}
                    </strong>
                    <small>{formatDate(selectedDiscussion.created_at)}</small>
                  </div>
                </div>

                <p>{selectedDiscussion.content}</p>
              </div>

              <div className="discussion-messages">
                <h3>Messages</h3>

                {loadingMessages ? (
                  <div className="discussion-loading-small">
                    <LoaderCircle className="spin" size={20} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="discussion-no-messages">
                    Aucun message pour le moment. Lance la conversation !
                  </div>
                ) : (
                  messages.map((message) => {
                    const author = profiles[message.author_id];
                    const isMine = message.author_id === userId;

                    return (
                      <div
                        key={message.id}
                        className={`discussion-message ${isMine ? "mine" : ""}`}
                      >
                        <span className="discussion-message-avatar">
                          {author?.avatar || "👤"}
                        </span>

                        <div className="discussion-message-content">
                          <div className="discussion-message-meta">
                            <strong>{isMine ? "Toi" : author?.username || "Membre"}</strong>
                            <small>{formatDate(message.created_at)}</small>
                          </div>
                          <p>{message.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="discussion-composer" onSubmit={sendMessage}>
                <input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Écris ton message..."
                  maxLength={3000}
                  aria-label="Ton message"
                />
                <button type="submit" disabled={!messageText.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="discussion-placeholder">
              <MessageCircle size={48} />
              <h2>À toi de lancer la conversation</h2>
              <p>Sélectionne une discussion ou crée un nouveau sujet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
