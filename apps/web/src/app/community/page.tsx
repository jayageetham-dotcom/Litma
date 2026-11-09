"use client";
import { Suspense } from "react";
import { InkLoader } from "@/components/ui/Skeleton";
import { Community } from "@/components/community/Community";

/** /community/: Litma's forum (see components/community/Community.tsx for the views). */
export default function CommunityPage() {
  return (
    <Suspense fallback={<InkLoader />}>
      <Community />
    </Suspense>
  );
}
