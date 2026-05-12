import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-[18px] font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-[13px] text-slate-500 mb-6 text-center max-w-md">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button onClick={() => window.location.reload()} className="rounded-xl bg-teal-600 hover:bg-teal-700 gap-2">
            <RefreshCw size={14} /> Reload Page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
