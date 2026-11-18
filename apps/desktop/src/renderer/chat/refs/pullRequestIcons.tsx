// Copied from t3code apps/web/src/components/pullRequest/pullRequestIcons.tsx at the commit
// in THIRD_PARTY_NOTICES.md (MIT). Changes: our state type, tones from theme tokens, only
// the glyphs we use, the issue icons (ours), and `dim` (ours). The tone class sets `--st`,
// the color of the icon and the outline (RefChip); the number stays in ink.
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
  /** The item is closed without a result: its number shows dim. */
  readonly dim: boolean;
  readonly Icon: PullRequestGlyphIcon;
}

export const PULL_REQUEST_STATE_PRESENTATION = {
  open: {
    label: "Open",
    toneClassName: "[--st:var(--color-pr-open)]",
    dim: false,
    Icon: PullRequestGlyph.pullRequest,
  },
  draft: {
    label: "Draft",
    toneClassName: "[--st:var(--color-pr-draft)]",
    dim: false,
    Icon: PullRequestGlyph.draft,
  },
  closed: {
    label: "Closed",
    // Grey, not red: red only means "needs you" (the owner, 2026-11-18, #188).
    toneClassName: "[--st:var(--color-pr-draft)]",
    dim: true,
    Icon: PullRequestGlyph.closed,
  },
  merged: {
    label: "Merged",
    toneClassName: "[--st:var(--color-pr-merged)]",
    dim: false,
    Icon: PullRequestGlyph.merged,
  },
} as const satisfies Record<Extract<RefState, { kind: "pr" }>["state"], PullRequestStatePresentation>;

/** Ours: issues, with GitHub's icons and colors. */
export const ISSUE_STATE_PRESENTATION = {
  open: { label: "Open", toneClassName: "[--st:var(--color-issue-open)]", dim: false, Icon: CircleDotIcon },
  closed: { label: "Closed", toneClassName: "[--st:var(--color-issue-done)]", dim: false, Icon: CircleCheckIcon },
  "not-planned": { label: "Not planned", toneClassName: "[--st:var(--color-issue-notplanned)]", dim: true, Icon: CircleSlashIcon },
} as const satisfies Record<Extract<RefState, { kind: "issue" }>["state"], PullRequestStatePresentation>;

export function refPresentation(ref: RefState): PullRequestStatePresentation {
  return ref.kind === "pr" ? PULL_REQUEST_STATE_PRESENTATION[ref.state] : ISSUE_STATE_PRESENTATION[ref.state];
}
