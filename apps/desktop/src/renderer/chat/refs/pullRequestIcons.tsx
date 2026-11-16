// Copied from t3code apps/web/src/components/pullRequest/pullRequestIcons.tsx at the commit
// in THIRD_PARTY_NOTICES.md (MIT). Changes: our state type, tones from theme tokens, only
// the glyphs we use, and the issue icons (ours).
import {
  CircleCheckIcon,
  CircleDotIcon,
  CircleSlashIcon,
  GitMergeIcon,
  GitPullRequestArrowIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
} from "lucide-react";
import type { RefState } from "../../../shared/api";

export const PullRequestGlyph = {
  pullRequest: GitPullRequestArrowIcon,
  draft: GitPullRequestDraftIcon,
  closed: GitPullRequestClosedIcon,
  merged: GitMergeIcon,
} as const;

export type PullRequestGlyphIcon = typeof GitMergeIcon;

export interface PullRequestStatePresentation {
  readonly label: string;
  readonly toneClassName: string;
  readonly Icon: PullRequestGlyphIcon;
}

export const PULL_REQUEST_STATE_PRESENTATION = {
  open: {
    label: "Open",
    toneClassName: "text-ref-open",
    Icon: PullRequestGlyph.pullRequest,
  },
  draft: {
    label: "Draft",
    toneClassName: "text-muted",
    Icon: PullRequestGlyph.draft,
  },
  closed: {
    label: "Closed",
    toneClassName: "text-ref-closed",
    Icon: PullRequestGlyph.closed,
  },
  merged: {
    label: "Merged",
    toneClassName: "text-ref-merged",
    Icon: PullRequestGlyph.merged,
  },
} as const satisfies Record<Extract<RefState, { kind: "pr" }>["state"], PullRequestStatePresentation>;

/** Ours: issues, with GitHub's icons and colors. */
export const ISSUE_STATE_PRESENTATION = {
  open: { label: "Open", toneClassName: "text-ref-open", Icon: CircleDotIcon },
  closed: { label: "Closed", toneClassName: "text-ref-merged", Icon: CircleCheckIcon },
  "not-planned": { label: "Not planned", toneClassName: "text-muted", Icon: CircleSlashIcon },
} as const satisfies Record<Extract<RefState, { kind: "issue" }>["state"], PullRequestStatePresentation>;

export function refPresentation(ref: RefState): PullRequestStatePresentation {
  return ref.kind === "pr" ? PULL_REQUEST_STATE_PRESENTATION[ref.state] : ISSUE_STATE_PRESENTATION[ref.state];
}
