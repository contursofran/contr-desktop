"use client";

import { createParts } from "@ui-sdk/react/primitive";
import { tabOrder } from "./tab-order";

export const { Root: TabOrderRoot, Item: TabOrderItem } = createParts(tabOrder, { root: "div", item: "div" });
