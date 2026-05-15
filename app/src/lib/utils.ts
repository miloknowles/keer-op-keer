import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRoomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const ADJECTIVES = [
  "Bold", "Brave", "Calm", "Clever", "Cool", "Daring", "Eager",
  "Fast", "Fierce", "Gentle", "Happy", "Jolly", "Keen", "Lucky",
  "Mighty", "Noble", "Quick", "Sharp", "Sly", "Swift", "Wild", "Wise",
]

const ANIMALS = [
  "Badger", "Bear", "Crane", "Deer", "Eagle", "Falcon", "Fox",
  "Hawk", "Heron", "Ibis", "Jaguar", "Lynx", "Mink", "Otter",
  "Owl", "Panda", "Raven", "Robin", "Tiger", "Viper", "Wolf",
]

export function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj} ${animal}`
}

export const NAME_KEY = "kok_display_name"
