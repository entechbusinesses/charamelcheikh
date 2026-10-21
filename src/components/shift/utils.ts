import { isAxiosError } from "axios";

/** Server message of a failed request, or `fallback` */
export const apiErrorMessage = (error: unknown, fallback: string) =>
  (isAxiosError(error) && error.response?.data?.message) || fallback;

export const formatDH = (n: number) => `${n.toFixed(2)} DH`;

/** "2 h 05" between two dates */
export const formatDuration = (from: string, to: string) => {
  const minutes = Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000),
  );
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};
