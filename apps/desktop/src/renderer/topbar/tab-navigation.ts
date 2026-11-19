import { matchesShortcut } from "@ui-sdk/core";
import { registerShortcut, shortcuts } from "@ui-sdk/react/shortcuts";
import { useEffect, useRef, type WheelEvent as ReactWheelEvent } from "react";

const SWITCH_TAB = "Switch tab";

/** Let the app handle a tab chord ahead of xterm only when it has a target. */
export function isActiveTabShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return false;
  const mac = window.contr.platform === "darwin";
  return shortcuts.list().some(({ keys, description }) => description === SWITCH_TAB && matchesShortcut(event, keys, mac));
}

function adjacentTab(tabs: string[], selected: string, step: -1 | 1): string | undefined {
  const index = tabs.indexOf(selected);
  if (index < 0 || tabs.length < 2) return;
  return tabs[(index + step + tabs.length) % tabs.length];
}

export function useTabNavigation(tabs: string[], selected: string, select: (tab: string) => void, mac: boolean) {
  const wheel = useRef({ pixels: 0, stepped: false, at: -Infinity, lastStep: -Infinity });
  useEffect(() => {
    const previous = adjacentTab(tabs, selected, -1);
    const next = adjacentTab(tabs, selected, 1);
    const bindings: (readonly [string, string | undefined])[] = [
      ["ctrl+shift+tab", previous], ["ctrl+tab", next],
      ...(mac ? [
        ["meta+shift+{", previous], ["meta+shift+}", next],
        ["meta+shift+[", previous], ["meta+shift+]", next],
      ] as const : [
        ["ctrl+pageup", previous], ["ctrl+pagedown", next],
        ["alt+[", previous], ["alt+]", next],
      ] as const),
    ];
    if (selected) {
      tabs.slice(0, 9).forEach((tab, index) => bindings.push([`${mac ? "meta" : "ctrl"}+${index + 1}`, tab]));
    }
    const off = bindings.flatMap(([key, tab]) =>
      tab && tab !== selected ? [registerShortcut(key, () => select(tab), { description: SWITCH_TAB })] : [],
    );
    return () => off.forEach((remove) => remove());
  }, [tabs, selected, select, mac]);

  return (event: ReactWheelEvent) => {
    const { deltaX, deltaY, ctrlKey, shiftKey, deltaMode, timeStamp } = event;
    if (ctrlKey || shiftKey || Math.abs(deltaY) <= Math.abs(deltaX)) return;
    const tab = adjacentTab(tabs, selected, deltaY > 0 ? 1 : -1);
    if (!tab) return;
    if (deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      select(tab);
      return;
    }
    // Step once for a short swipe. Larger swipes can step again without skipping a tab per wheel event.
    const gesture = wheel.current;
    if (timeStamp - gesture.at > 250 || (gesture.pixels !== 0 && Math.sign(gesture.pixels) !== Math.sign(deltaY))) {
      gesture.pixels = 0;
      gesture.stepped = false;
    }
    gesture.at = timeStamp;
    gesture.pixels += deltaY;
    const threshold = gesture.stepped ? 60 : 20;
    if (Math.abs(gesture.pixels) < threshold || timeStamp - gesture.lastStep < 100) return;
    gesture.pixels -= Math.sign(deltaY) * threshold;
    gesture.stepped = true;
    gesture.lastStep = timeStamp;
    select(tab);
  };
}
