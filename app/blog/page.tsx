import type { Metadata } from "next";
import BlogIndexView from "./index-view";
import { POSTS } from "./posts";

export const metadata: Metadata = {
  title: "Blog — Klip",
  description:
    "Articles pour les agences et community managers qui gèrent plusieurs clients Instagram : outils, organisation, validation client.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const posts = POSTS.map(({ Body, ...meta }) => meta);
  return <BlogIndexView posts={posts} />;
}
