import { createChange, createReorder, definePrimitive, isRTL, type ChangeDetails, type ReorderDraft, type ReorderReason } from "@ui-sdk/core";

export type TabOrderOptions = {
  value?: string[];
  onValueChange?: (value: string[], details: ChangeDetails<ReorderReason>) => void;
};

const MOVE_KEYS = new Set<string>(["ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * The top bar's tabs in an order that a drag (pointer) or Alt with Left, Right, Home or End changes.
 * Space and Enter stay the tab's own (select it), so the keyboard move picks up, moves and drops in one key press.
 * `reorder.keydown` ignores keys held with Alt, so this calls `moveTo` itself.
 */
export const tabOrder = definePrimitive({
  name: "tab-order",
  options: { value: "list", onValueChange: "callback" },
  controlled: ["value"],
  state: (options: TabOrderOptions) => ({ value: options.value ?? [], moving: null as ReorderDraft | null }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);
    const reorder = createReorder(context, {
      slot: "item",
      key: "value",
      draft: "moving",
      orientation: () => "horizontal",
      preview: true,
      set: (value, details) => change("value", value, details),
    });
    return {
      reorder,
      keydown(event: KeyboardEvent, key: string) {
        if (!event.altKey || !MOVE_KEYS.has(event.key) || !reorder.grab(key)) return;
        event.preventDefault();
        const order = reorder.order(context.store.get());
        const at = order.indexOf(key);
        const rtl = isRTL(event.currentTarget as HTMLElement);
        const step = (event.key === "ArrowRight") !== rtl ? 1 : -1;
        const to = event.key === "Home" ? 0 : event.key === "End" ? order.length - 1 : at + step;
        reorder.moveTo(Math.max(0, Math.min(order.length - 1, to)));
        reorder.drop(event);
      },
    };
  },
  slots: (slot) => ({
    root: slot({ state: (state) => ({ order: state.moving?.order ?? state.value }) }),
    item: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({ "data-grabbed": state.moving?.pointer && state.moving.keys.includes(part.key) ? "" : undefined }),
      on: {
        keydown: (event, { api, key }) => api.keydown(event, key),
        pointerdown: (event, { api, key }) => {
          if ((event.target as Element).closest("[data-tab-close]")) return;
          api.reorder.pointerdown(event, key);
        },
      },
      bind: (el, part) => part.api.reorder.bind(el, part),
    }),
  }),
});
