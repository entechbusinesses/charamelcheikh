import { isAxiosError } from "axios";
import { toast } from "@/hooks/use-toast";

/** The server's `message` when it sent one, the fallback otherwise */
export const apiErrorMessage = (error: unknown, fallback: string): string =>
  (isAxiosError(error) && error.response?.data?.message) || fallback;

/** Shows an error toast; the page stays as it is */
export const notifyError = (error: unknown, fallback: string) => {
  if (error) console.error(error);
  toast({
    variant: "destructive",
    title: "Erreur",
    description: apiErrorMessage(error, fallback),
  });
};

export const notifySuccess = (message: string) =>
  toast({ title: "Succès", description: message });
