"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import { thumbUrl } from "@/components/MediaThumb";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "draft" | "generated" | "validated" | "published";
type StatusFilter = "all" | PostStatus;

interface Post {
  id: string;
  photo_url: string;
  brief: string;
  description: string;
  texte_visuel: string;
  status: PostStatus;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CLASSNAMES: Record<PostStatus, string> = {
  draft:     "bg-[#F0F0F0] text-[#888]",
  generated: "bg-blue-50 text-blue-600",
  validated: "bg-acid text-black",
  published: "bg-green-50 text-green-700",
};

function StatusBadge({ status, label }: { status: PostStatus; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-inter font-bold ${STATUS_CLASSNAMES[status] ?? STATUS_CLASSNAMES.draft}`}>
      {label}
    </span>
  );
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoriquePage() {
  const t = useTranslations('workspaceHistory');
  const locale = useLocale();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClientComponentClient();

  const STATUS_LABELS: Record<PostStatus, string> = {
    draft: t('statusDraft'), generated: t('statusGenerated'), validated: t('statusValidated'), published: t('statusPublished'),
  };
  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t('filterAll') },
    { key: "draft", label: t('statusDraft') },
    { key: "generated", label: t('statusGenerated') },
    { key: "validated", label: t('statusValidated') },
    { key: "published", label: t('statusPublished') },
  ];

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, logo_url, primary_color, secondary_color, font_family")
      .eq("id", id)
      .single();

    if (ws) setWorkspace(ws);

    const { data: postsData } = await supabase
      .from("posts")
      .select("id, photo_url, brief, description, texte_visuel, status, created_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false });

    setPosts((postsData ?? []).map((p) => ({
      ...p,
      brief: p.brief ?? "",
      description: p.description ?? "",
      texte_visuel: p.texte_visuel ?? "",
      status: (p.status as PostStatus) ?? "draft",
    })));
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  const initials = workspace ? getInitials(workspace.name) : "…";

  const countByStatus = (s: PostStatus) => posts.filter((p) => p.status === s).length;

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-acid flex items-center justify-center shrink-0 overflow-hidden">
              {workspace?.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={workspace.logo_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-sm font-syne font-bold text-black">{initials}</span>
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-syne font-extrabold text-lg text-black leading-none">
                  {workspace?.name ?? "…"}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-acid text-black text-xs font-inter font-bold">
                  {t('active')}
                </span>
              </div>
              <p className="text-xs font-inter text-[#888] mt-0.5">{t('subtitle')}</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
            <span className="text-xs font-syne font-bold text-white">MK</span>
          </div>
        </header>

        {/* Sub-nav */}
        <div className="flex items-center gap-0 px-8 border-b border-[#E0E0E0] bg-white">
          <Link
            href={`/workspace/${id}`}
            className="relative px-5 py-3.5 text-sm font-inter font-medium text-[#888] hover:text-black transition-colors"
          >
            {t('navProduce')}
          </Link>
          <div className="relative px-5 py-3.5 text-sm font-inter font-medium text-black">
            {t('navHistory')}
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-acid" />
          </div>
          <Link
            href={`/workspace/${id}`}
            className="relative px-5 py-3.5 text-sm font-inter font-medium text-[#888] hover:text-black transition-colors"
            onClick={(e) => { e.preventDefault(); window.location.href = `/workspace/${id}?tab=parametres`; }}
          >
            {t('navSettings')}
          </Link>
        </div>

        <main className="flex-1 px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-syne font-extrabold text-xl text-black mb-1">{t('title')}</h2>
              <p className="text-sm font-inter text-[#888]">{t('postsTotal', { count: posts.length })}</p>
            </div>
            <Link
              href={`/workspace/${id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-acid text-black text-sm font-inter font-bold hover:bg-acid/90 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              {t('newPost')}
            </Link>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {(["draft", "generated", "validated", "published"] as PostStatus[]).map((s) => {
              const count = countByStatus(s);
              return (
                <div key={s} className="bg-[#F5F5F5] border border-[#E0E0E0] rounded px-4 py-3">
                  <p className="font-syne font-extrabold text-2xl text-black leading-none mb-1">{count}</p>
                  <p className="text-xs font-inter text-[#888]">{STATUS_LABELS[s]}</p>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-6">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 rounded text-xs font-inter font-medium transition-colors ${
                  filter === f.key
                    ? "bg-black text-white"
                    : "bg-[#F5F5F5] text-[#555] hover:bg-[#EBEBEB]"
                }`}
              >
                {f.label}
                {f.key !== "all" && (
                  <span className={`ml-1.5 ${filter === f.key ? "opacity-60" : "opacity-40"}`}>
                    {posts.filter((p) => p.status === f.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin w-5 h-5 text-[#CCC]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-solid border-[#E0E0E0] rounded">
              <p className="font-syne font-bold text-base text-black mb-2">{t('noPost')}</p>
              <p className="text-sm font-inter text-[#888]">
                {filter === "all"
                  ? t('emptyAll')
                  : t('emptyFiltered', { status: STATUS_LABELS[filter as PostStatus] })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-5 p-5 bg-white border border-[#E0E0E0] rounded hover:border-black transition-colors"
                >
                  {/* Thumbnail with brand overlay */}
                  <div className="w-20 h-20 rounded border border-[#E0E0E0] overflow-hidden shrink-0 bg-[#F5F5F5] relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.photo_url ? thumbUrl(post.photo_url, 160) : undefined} alt="" className="w-full h-full object-cover" />
                    {post.texte_visuel && (
                      <div style={{
                        position: "absolute", bottom: 4, left: 4, right: 4,
                        background: workspace?.primary_color ?? "#0038FF",
                        color: workspace?.secondary_color ?? "#FFFFFF",
                        fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif",
                        fontWeight: "bold", fontSize: "7px",
                        padding: "2px 4px", borderRadius: "2px",
                        textTransform: "uppercase",
                        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                      }}>
                        {post.texte_visuel}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={post.status} label={STATUS_LABELS[post.status]} />
                      <span className="text-xs font-inter text-[#AAA]">
                        {new Date(post.created_at).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {post.brief && (
                      <p className="text-xs font-inter text-[#888] mb-2 line-clamp-1">
                        <span className="font-medium text-[#555]">{t('briefLabel')}</span> {post.brief}
                      </p>
                    )}

                    {post.description ? (
                      <p className="text-sm font-inter text-[#333] line-clamp-3 leading-relaxed">
                        {post.description}
                      </p>
                    ) : (
                      <p className="text-sm font-inter text-[#BBB] italic">{t('noDescriptionYet')}</p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    <Link
                      href={`/workspace/${id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E0E0E0] text-xs font-inter font-medium text-[#555] hover:border-black hover:text-black transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 8.5l1.2-1.2 5.6-5.6 1.2 1.2-5.6 5.6L2 8.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                        <path d="M7.6 1.7l1.2 1.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      {t('edit')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
