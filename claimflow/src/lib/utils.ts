import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function getFraudColor(score: number): string {
  if (score <= 30) return "text-green-600";
  if (score <= 60) return "text-yellow-600";
  if (score <= 80) return "text-red-500";
  return "text-red-800";
}

export function getFraudBgColor(score: number): string {
  if (score <= 30) return "bg-green-50 border-green-200";
  if (score <= 60) return "bg-yellow-50 border-yellow-200";
  if (score <= 80) return "bg-red-50 border-red-200";
  return "bg-red-100 border-red-400";
}

export function getStatusColor(status: string): "success" | "warning" | "danger" | "secondary" | "default" {
  const map: Record<string, "success" | "warning" | "danger" | "secondary" | "default"> = {
    SUBMITTED: "default",
    UNDER_REVIEW: "warning",
    INFO_REQUESTED: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    CLOSED: "secondary",
  };
  return map[status] || "default";
}
