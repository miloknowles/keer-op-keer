import { GreedyBot } from "./greedy";
import type { BotStrategy } from "./types";

const REGISTRY: Record<string, BotStrategy> = {
  greedy: new GreedyBot(),
};

export const BOT_TYPES = Object.keys(REGISTRY);

export function getBotStrategy(type: string): BotStrategy {
  return REGISTRY[type] ?? REGISTRY.greedy;
}
