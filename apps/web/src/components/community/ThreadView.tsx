"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, Heart, Lock, MessageCircle, MoreHorizontal, Pencil, Pin, ShieldAlert, Trash2, UserX } from "lucide-react";
import { useT } from "@/i18n/react";
import { useConfirm } from "@/components/ui/Confirm";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { CATEGORIES, LIMITS, community, isLocalCommunity, type Category, type Me, type ModAction, type Reply, type Thread } from "@/lib/community";
import { AuthorAvatar, CategoryChip, PostBody, PostField, display, problemText, useAgo } from "./bits";
import { AgreeDialog, BanDialog, ModerateDialog, ReportDialog } from "./Dialogs";
import { Select } from "@/components/ui/Select";

type Modal =
  | { kind: "agree"; then: () => void }
  | { kind: "report"; replyId: string | null }
  | { kind: "moderate"; action: "close" | "remove" | "remove_reply"; replyId: string | null }
  | { kind: "ban"; userId: string; name: string; lift: boolean }
  | null;

export function ThreadView({ id, me, onMe }: { id: string; me: Me; onMe: () => void }) {
  const t = useT();
  const ago = useAgo();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDialog, ask] = useConfirm();
  const composer = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const th = await community.thread(id);
      setThread(th);
      if (!th) return;
      const rs = await community.replies(id);
      setReplies(rs);
      setLiked(await community.liked([th.id, ...rs.map((r) => r.id)]));
    } catch (e) {
      setError(problemText(t, e));
      setThread((x) => (x === undefined ? null : x));
    }
  }, [id, t]);
  useEffect(() => {
    load();
  }, [load]);

  const banned = !!me.banned_until;
  const canReply = thread?.status === "open" && !banned;

  /** Run `fn` once the writer has agreed to the guidelines (asks first if needed). */
  const withAgreement = (fn: () => void) => {
    if (me.agreed) fn();
    else setModal({ kind: "agree", then: fn });
  };

  const send = async () => {
    if (!thread || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r = await community.reply(thread.id, draft);
      setReplies((rs) => [...rs, r]);
      setThread((th) => (th ? { ...th, reply_count: th.reply_count + 1 } : th));
      setDraft("");
    } catch (e) {
      setError(problemText(t, e));
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = (targetId: string, kind: "thread" | "reply") =>
    withAgreement(async () => {
      const on = !liked.has(targetId);
      setLiked((s) => {
        const n = new Set(s);
        if (on) n.add(targetId);
        else n.delete(targetId);
        return n;
      });
      const bump = (n: number) => Math.max(0, n + (on ? 1 : -1));
      if (kind === "thread") setThread((th) => (th ? { ...th, like_count: bump(th.like_count) } : th));
      else setReplies((rs) => rs.map((r) => (r.id === targetId ? { ...r, like_count: bump(r.like_count) } : r)));
      try {
        await community.like(targetId, kind, on);
      } catch (e) {
        setError(problemText(t, e));
        load();
      }
    });

  const del = async (replyId: string | null) => {
    if (!thread) return;
    const ok = await ask({ title: replyId ? t("community.deleteDialog.reply") : t("community.deleteDialog.thread"), body: t("community.deleteDialog.body"), confirm: t("community.delete"), danger: true });
    if (!ok) return;
    try {
      await community.remove(thread.id, replyId);
      if (replyId) {
        setReplies((rs) => rs.filter((r) => r.id !== replyId));
        setThread((th) => (th ? { ...th, reply_count: Math.max(0, th.reply_count - 1) } : th));
      } else {
        router.push("/community/");
      }
    } catch (e) {
      setError(problemText(t, e));
    }
  };

  const quick = async (action: ModAction, replyId: string | null = null) => {
    if (!thread) return;
    try {
      await community.moderate(action, thread.id, replyId);
      await load();
    } catch (e) {
      setError(problemText(t, e));
    }
  };

  if (thread === undefined)
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-9 w-3/4" />
        <div className="mt-8 rounded-[1.75rem] border border-line bg-surface p-6">
          <SkeletonLines lines={5} />
        </div>
      </div>
    );

  if (!thread)
    return (
      <div className="mx-auto max-w-3xl text-center">
        <BackLink />
        <p className="mt-16 text-lg font-semibold">{error || t("community.notFound")}</p>
      </div>
    );

  const own = (authorId: string) => authorId === me.user_id;

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <CategoryChip category={thread.category} />
        {thread.pinned && <Badge icon={<Pin size={12} />} text={t("community.pinned")} />}
        {thread.status === "closed" && <Badge icon={<Lock size={12} />} text={t("community.closed")} />}
        {thread.status === "removed" && <Badge icon={<ShieldAlert size={12} />} text={t("community.removed")} danger />}
      </div>
      <h1 className="mt-3 break-words text-3xl font-extrabold leading-tight tracking-tight md:text-4xl" style={display} data-private>
        {thread.title}
      </h1>

      {thread.status !== "open" && (
        <div className={`mt-5 rounded-2xl border p-4 text-[15px] ${thread.status === "removed" ? "border-danger/40 bg-danger-soft" : "border-line-strong bg-subtle"}`} role="status">
          <p className="font-bold">{thread.status === "removed" ? t("community.status.removedBy") : t("community.status.closedBy")}</p>
          {thread.mod_reason && <p className="mt-1">{t("community.status.reason", { reason: t(`community.reason.${thread.mod_reason}`) })}</p>}
          {thread.mod_note && <p className="mt-1 text-muted">{thread.mod_note}</p>}
          <p className="mt-1 text-muted">
            {thread.status === "removed" ? t("community.status.removedHint") : t("community.status.closedHint")}{" "}
            <Link href="/community/guidelines/" className="font-semibold text-violet-text underline underline-offset-2">
              {t("community.guidelines")}
            </Link>
          </p>
        </div>
      )}

      {/* the opening post */}
      <article className="mt-6 rounded-[1.75rem] border border-line bg-surface p-5 shadow-[var(--pop-chip-shadow)] md:p-7">
        <PostHead author={thread} at={thread.created_at} edited={thread.edited_at} you={own(thread.author_id)} ago={ago} />
        {editing === thread.id ? (
          <EditThread thread={thread} isAdmin={me.is_admin} onCancel={() => setEditing(null)} onSaved={(p) => (setThread({ ...thread, ...p, edited_at: new Date().toISOString() }), setEditing(null))} />
        ) : (
          <PostBody text={thread.body} className="mt-4" />
        )}
        <Actions>
          <LikeButton on={liked.has(thread.id)} n={thread.like_count} onClick={() => toggleLike(thread.id, "thread")} disabled={banned} />
          {canReply && (
            <button className="btn btn-ghost !px-3 text-sm" onClick={() => composer.current?.querySelector("textarea")?.focus()}>
              <MessageCircle size={15} /> {t("community.reply")}
            </button>
          )}
          <span className="flex-1" />
          {own(thread.author_id) && thread.status === "open" && editing !== thread.id && (
            <button className="btn btn-ghost !px-3 text-sm" onClick={() => setEditing(thread.id)}>
              <Pencil size={14} /> {t("community.edit")}
            </button>
          )}
          {own(thread.author_id) && (
            <button className="btn btn-ghost !px-3 text-sm" onClick={() => del(null)}>
              <Trash2 size={14} /> {t("community.delete")}
            </button>
          )}
          {!own(thread.author_id) && (
            <button className="btn btn-ghost !px-3 text-sm" onClick={() => setModal({ kind: "report", replyId: null })}>
              <Flag size={14} /> {t("community.report")}
            </button>
          )}
          {me.is_admin && (
            <ModMenu
              items={[
                thread.status === "open" ? { label: t("community.mod.close"), run: () => setModal({ kind: "moderate", action: "close", replyId: null }) } : { label: t("community.mod.reopen"), run: () => quick("reopen") },
                thread.status === "removed" ? { label: t("community.mod.restore"), run: () => quick("restore") } : { label: t("community.mod.remove"), run: () => setModal({ kind: "moderate", action: "remove", replyId: null }), danger: true },
                thread.pinned ? { label: t("community.mod.unpin"), run: () => quick("unpin") } : { label: t("community.mod.pin"), run: () => quick("pin") },
                ...(!own(thread.author_id) && !isLocalCommunity() ? [{ label: t("community.mod.ban"), run: () => setModal({ kind: "ban", userId: thread.author_id, name: thread.author_name, lift: false }), danger: true }, { label: t("community.mod.unban"), run: () => setModal({ kind: "ban", userId: thread.author_id, name: thread.author_name, lift: true }) }] : []),
              ]}
            />
          )}
        </Actions>
      </article>

      {/* replies */}
      <h2 className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-coral-text">{t("community.replies", { count: replies.filter((r) => !r.removed).length })}</h2>
      <ol className="mt-4 grid gap-3">
        {replies.map((r) => (
          <li key={r.id} id={`r-${r.id}`} className={`rounded-[1.4rem] border p-5 ${r.removed ? "border-dashed border-danger/40 bg-danger-soft/40" : "border-line bg-surface"}`}>
            <PostHead author={r} at={r.created_at} edited={r.edited_at} you={own(r.author_id)} ago={ago} small />
            {r.removed && (
              <p className="mt-3 text-sm font-semibold text-danger" role="status">
                {t("community.status.replyRemoved")} {r.mod_reason && `(${t(`community.reason.${r.mod_reason}`)})`}
              </p>
            )}
            {editing === r.id ? (
              <EditReply reply={r} onCancel={() => setEditing(null)} onSaved={(body) => (setReplies((rs) => rs.map((x) => (x.id === r.id ? { ...x, body, edited_at: new Date().toISOString() } : x))), setEditing(null))} />
            ) : (
              <PostBody text={r.body} className="mt-3" />
            )}
            <Actions>
              <LikeButton on={liked.has(r.id)} n={r.like_count} onClick={() => toggleLike(r.id, "reply")} disabled={banned || r.removed} />
              <span className="flex-1" />
              {own(r.author_id) && thread.status === "open" && !r.removed && editing !== r.id && (
                <button className="btn btn-ghost !px-3 text-sm" onClick={() => setEditing(r.id)}>
                  <Pencil size={14} /> {t("community.edit")}
                </button>
              )}
              {own(r.author_id) && (
                <button className="btn btn-ghost !px-3 text-sm" onClick={() => del(r.id)}>
                  <Trash2 size={14} /> {t("community.delete")}
                </button>
              )}
              {!own(r.author_id) && !r.removed && (
                <button className="btn btn-ghost !px-3 text-sm" onClick={() => setModal({ kind: "report", replyId: r.id })}>
                  <Flag size={14} /> {t("community.report")}
                </button>
              )}
              {me.is_admin && (
                <ModMenu
                  items={[
                    r.removed ? { label: t("community.mod.restoreReply"), run: () => quick("restore_reply", r.id) } : { label: t("community.mod.removeReply"), run: () => setModal({ kind: "moderate", action: "remove_reply", replyId: r.id }), danger: true },
                    ...(!own(r.author_id) && !isLocalCommunity() ? [{ label: t("community.mod.ban"), run: () => setModal({ kind: "ban", userId: r.author_id, name: r.author_name, lift: false }), danger: true }, { label: t("community.mod.unban"), run: () => setModal({ kind: "ban", userId: r.author_id, name: r.author_name, lift: true }) }] : []),
                  ]}
                />
              )}
            </Actions>
          </li>
        ))}
      </ol>

      {/* reply box */}
      <div ref={composer} className="mt-8">
        {banned ? (
          <BannedNote me={me} />
        ) : thread.status !== "open" ? (
          <p className="flex items-center gap-2 rounded-2xl border border-line bg-subtle p-4 text-[15px] text-muted">
            <Lock size={16} /> {t("community.status.closedHint")}
          </p>
        ) : (
          <div className="rounded-[1.75rem] border border-line bg-surface p-5 md:p-6">
            <PostField id="reply" label={t("community.new.replyTo")} placeholder={t("community.new.replyPlaceholder")} value={draft} onChange={setDraft} max={LIMITS.reply} rows={4} />
            {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-xs text-muted">{t("community.new.responsible")}</p>
              <button className="btn btn-primary" disabled={busy || !draft.trim()} onClick={() => withAgreement(send)}>
                {busy ? t("community.posting") : t("community.post")}
              </button>
            </div>
          </div>
        )}
      </div>

      {modal?.kind === "agree" && (
        <AgreeDialog
          onClose={() => setModal(null)}
          onDone={() => {
            const then = modal.then;
            setModal(null);
            onMe();
            then();
          }}
        />
      )}
      {modal?.kind === "report" && <ReportDialog threadId={thread.id} replyId={modal.replyId} onClose={() => setModal(null)} />}
      {modal?.kind === "moderate" && <ModerateDialog action={modal.action} threadId={thread.id} replyId={modal.replyId} onClose={() => setModal(null)} onDone={() => (setModal(null), load())} />}
      {modal?.kind === "ban" && <BanDialog userId={modal.userId} name={modal.name} lift={modal.lift} onClose={() => setModal(null)} onDone={() => setModal(null)} />}
      {confirmDialog}
    </div>
  );
}

function BackLink() {
  const t = useT();
  return (
    <Link href="/community/" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink">
      <ArrowLeft size={16} /> {t("community.back")}
    </Link>
  );
}

function Badge({ icon, text, danger }: { icon: React.ReactNode; text: string; danger?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${danger ? "bg-danger-soft text-danger" : "bg-subtle text-ink"}`}>{icon}{text}</span>;
}

export function BannedNote({ me }: { me: Me }) {
  const t = useT();
  const forever = me.banned_until && new Date(me.banned_until).getFullYear() > 9000;
  return (
    <div className="flex gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-[15px]" role="status">
      <UserX size={18} className="mt-0.5 shrink-0 text-danger" />
      <div>
        <p className="font-bold">{forever ? t("community.status.bannedForever") : t("community.status.banned", { date: new Date(me.banned_until!).toLocaleDateString() })}</p>
        {me.ban_reason && <p className="mt-1">{t("community.status.reason", { reason: me.ban_reason })}</p>}
        <Link href="/community/guidelines/" className="mt-1 inline-block font-semibold text-violet-text underline underline-offset-2">
          {t("community.guidelines")}
        </Link>
      </div>
    </div>
  );
}

function PostHead({ author, at, edited, you, ago, small }: { author: Thread | Reply; at: string; edited: string | null; you: boolean; ago: (iso: string) => string; small?: boolean }) {
  const t = useT();
  return (
    <header className="flex items-center gap-3">
      <AuthorAvatar author={author} size={small ? 32 : 40} />
      <div className="min-w-0">
        <p className="truncate font-bold" data-private>
          {author.author_name}
          {you && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-[11px] font-extrabold text-on-pop">{t("community.you")}</span>}
        </p>
        <p className="text-xs text-muted">
          <time dateTime={at} title={new Date(at).toLocaleString()}>
            {ago(at)}
          </time>
          {edited && <> · {t("community.edited")}</>}
        </p>
      </div>
    </header>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="-mx-2 mt-4 flex flex-wrap items-center gap-0.5 border-t border-line pt-3">{children}</div>;
}

function LikeButton({ on, n, onClick, disabled }: { on: boolean; n: number; onClick: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <button className={`btn btn-ghost !px-3 text-sm ${on ? "!text-coral-text" : ""}`} aria-pressed={on} onClick={onClick} disabled={disabled} title={on ? t("community.unlike") : t("community.like")}>
      <Heart size={15} fill={on ? "currentColor" : "none"} /> <span className="tabular-nums">{n > 0 ? n : t("community.like")}</span>
    </button>
  );
}

function ModMenu({ items }: { items: { label: string; run: () => void; danger?: boolean }[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button className="btn btn-ghost !px-3 text-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-track="Moderate">
        <ShieldAlert size={14} /> {t("community.moderate")} <MoreHorizontal size={14} />
      </button>
      {open && (
        <div role="menu" className="dialog absolute bottom-full right-0 z-30 mb-2 grid w-64 gap-0.5 rounded-2xl p-1.5">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={`rounded-[6px] px-3 py-2 text-left text-sm font-semibold hover:bg-subtle ${it.danger ? "text-danger" : ""}`}
              onClick={() => {
                setOpen(false);
                it.run();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditThread({ thread, isAdmin, onCancel, onSaved }: { thread: Thread; isAdmin: boolean; onCancel: () => void; onSaved: (p: { title: string; body: string; category: Category }) => void }) {
  const t = useT();
  const [title, setTitle] = useState(thread.title);
  const [body, setBody] = useState(thread.body);
  const [category, setCategory] = useState<Category>(thread.category);
  const [error, setError] = useState("");
  const save = async () => {
    if (title.trim().length < 3 || !body.trim()) return setError(t("community.new.short"));
    try {
      await community.editThread(thread.id, { title, body, category });
      onSaved({ title: title.trim(), body: body.trim(), category });
    } catch (e) {
      setError(problemText(t, e));
    }
  };
  return (
    <div className="mt-4 grid gap-4">
      <Select label={t("community.new.category")} labelClassName="text-sm font-bold" value={category} onChange={(v) => setCategory(v as Category)} options={CATEGORIES.filter((c) => c.id !== "news" || isAdmin || thread.category === "news").map((c) => ({ value: c.id, label: t(`community.cat.${c.id}`) }))} />
      <PostField id="edit-title" label={t("community.new.subject")} value={title} onChange={setTitle} max={LIMITS.title} multiline={false} />
      <PostField id="edit-body" label={t("community.new.body")} value={body} onChange={setBody} max={LIMITS.thread} rows={8} />
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onCancel}>
          {t("community.cancel")}
        </button>
        <button className="btn btn-primary" onClick={save}>
          {t("community.save")}
        </button>
      </div>
    </div>
  );
}

function EditReply({ reply, onCancel, onSaved }: { reply: Reply; onCancel: () => void; onSaved: (body: string) => void }) {
  const t = useT();
  const [body, setBody] = useState(reply.body);
  const [error, setError] = useState("");
  const save = async () => {
    if (!body.trim()) return;
    try {
      await community.editReply(reply.id, body);
      onSaved(body.trim());
    } catch (e) {
      setError(problemText(t, e));
    }
  };
  return (
    <div className="mt-3 grid gap-3">
      <PostField id={`edit-${reply.id}`} label={t("community.edit")} value={body} onChange={setBody} max={LIMITS.reply} rows={4} />
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onCancel}>
          {t("community.cancel")}
        </button>
        <button className="btn btn-primary" onClick={save}>
          {t("community.save")}
        </button>
      </div>
    </div>
  );
}
