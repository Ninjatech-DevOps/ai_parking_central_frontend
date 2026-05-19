import { toast } from "sonner";

export const showSuccess = (message: string) => toast.success(message);
export const showError = (message: string) => toast.error(message);
export const showWarning = (message: string) => toast.warning(message);
export const showInfo = (message: string) => toast.info(message);

/** Show toast colored by alert severity */
export function showBySeverity(message: string, severity?: string) {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return toast.error(message);
    case "HIGH":
      return toast.error(message);
    case "MEDIUM":
      return toast.warning(message);
    case "LOW":
      return toast.info(message);
    default:
      return toast.info(message);
  }
}
