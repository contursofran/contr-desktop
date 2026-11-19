import type { AcceleratedTier, CodexOption, ReplyInfo } from "../../shared/api";
import type { CodexRpc } from "./rpc";

interface Model {
  model: string;
  displayName: string;
  hidden?: boolean;
  supportedReasoningEfforts?: { reasoningEffort: string }[];
  defaultReasoningEffort?: string;
  defaultServiceTier?: string | null;
  serviceTiers?: { id: string }[];
  additionalSpeedTiers?: string[];
}

interface Profile {
  id: string;
  allowed: boolean;
}

export interface EffectiveOptions {
  model: string;
  modelProvider?: string;
  reasoningEffort?: string | null;
  serviceTier?: string | null;
  activePermissionProfile?: { id: string } | null;
  sandbox?: { type: string };
}

const profileLabels = new Map([
  [":workspace", "Workspace"],
  [":read-only", "Read-only"],
  [":danger-full-access", "Full access"],
]);
const sandboxProfiles: Record<string, string> = {
  workspaceWrite: ":workspace", readOnly: ":read-only", dangerFullAccess: ":danger-full-access",
};

function acceleratedTier(id: string | null | undefined): AcceleratedTier | undefined {
  if (id === "priority" || id === "fast") return "fast";
  if (id === "ultrafast") return "ultrafast";
}

/** Use the catalog's service-tier ID on the wire, including legacy Fast. */
function speeds(model: Model | undefined) {
  const ids = model?.serviceTiers?.length ? model.serviceTiers.map((tier) => tier.id) : model?.additionalSpeedTiers ?? [];
  const tiers = new Map<AcceleratedTier, string>();
  for (const id of ids) {
    const value = acceleratedTier(id);
    if (value && !tiers.has(value)) tiers.set(value, id);
  }
  return tiers;
}

async function readCatalog<T>(rpc: CodexRpc, method: string, params: Record<string, unknown>): Promise<T[]> {
  const data: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await rpc.request<{ data: T[]; nextCursor?: string | null }>(method, { ...params, cursor });
    data.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return data;
}

type TurnOptions = { model?: string; effort?: string; serviceTier?: string; permissions?: string };

/** Display the thread's effective defaults. Send only options the owner selects. */
export class CodexOptions {
  private changes: TurnOptions = {};
  private models?: Promise<Model[]>;
  private permissions?: Promise<Profile[]>;

  constructor(private readonly rpc: CodexRpc, private readonly cwd: string, private readonly defaults: EffectiveOptions) {}

  private catalogs() {
    this.models ??= readCatalog<Model>(this.rpc, "model/list", { modelProvider: this.defaults.modelProvider })
      .then((models) => models.filter((model) => !model.hidden)).catch(() => []);
    this.permissions ??= readCatalog<Profile>(this.rpc, "permissionProfile/list", { cwd: this.cwd })
      .then((items) => items.filter((profile) => profile.allowed)).catch(() => []);
    return Promise.all([this.models, this.permissions]);
  }

  get model() { return this.changes.model ?? this.defaults.model; }

  turn(): TurnOptions { return { ...this.changes }; }

  private tier(model: Model | undefined) {
    const id = this.changes.serviceTier ?? this.defaults.serviceTier ?? model?.defaultServiceTier;
    return acceleratedTier(id) ?? "standard";
  }

  async info(): Promise<ReplyInfo> {
    const [models, permissions] = await this.catalogs();
    const model = models.find((entry) => entry.model === this.model);
    return {
      agent: "codex", model: this.model, effort: this.changes.effort ?? this.defaults.reasoningEffort ?? model?.defaultReasoningEffort ?? null,
      tier: this.tier(model), tiers: [...speeds(model).keys()], speed: null, context: null,
      models: models.map((entry) => ({ value: entry.model, label: entry.displayName })),
      efforts: model?.supportedReasoningEfforts?.map(({ reasoningEffort }) => ({ value: reasoningEffort, label: reasoningEffort })) ?? [],
      ...(permissions.length > 0 ? { permissions: {
        selected: this.changes.permissions ?? this.defaults.activePermissionProfile?.id ?? sandboxProfiles[this.defaults.sandbox?.type ?? ""] ?? null,
        choices: permissions.map(({ id }) => ({ value: id, label: profileLabels.get(id) ?? id })),
      } } : {}),
    };
  }

  async set({ kind, value }: CodexOption): Promise<ReplyInfo> {
    const [models, permissions] = await this.catalogs();
    const model = models.find((entry) => entry.model === this.model);
    if (kind === "model") {
      const next = models.find((entry) => entry.model === value);
      if (!next) throw new Error("Codex did not offer this model.");
      const tier = this.tier(model);
      const nextSpeed = tier !== "standard" ? speeds(next).get(tier) ?? "default" : this.changes.serviceTier;
      this.changes = { ...this.changes, model: next.model, effort: next.defaultReasoningEffort, serviceTier: nextSpeed };
    } else if (kind === "effort") {
      if (!model?.supportedReasoningEfforts?.some((option) => option.reasoningEffort === value)) throw new Error("This model does not offer that effort.");
      this.changes.effort = value;
    } else if (kind === "tier") {
      const speed = value === "standard" ? "default" : speeds(model).get(value as AcceleratedTier);
      if (!speed) throw new Error("This model does not offer that speed.");
      this.changes.serviceTier = speed;
    } else if (kind === "permission" && permissions.some((entry) => entry.id === value)) {
      this.changes.permissions = value;
    } else {
      throw new Error("Codex did not offer this permission profile.");
    }
    return this.info();
  }
}
