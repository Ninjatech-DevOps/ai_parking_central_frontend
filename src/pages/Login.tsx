import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParkingSquare, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await login(email, password); navigate("/"); }
    catch { setError("Invalid email or password"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-[480px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <ParkingSquare size={22} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white">AI Parking</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Smart Parking<br />Infrastructure
          </h2>
          <p className="text-slate-400 text-[15px] leading-relaxed max-w-sm">
            Real-time monitoring and management of 844+ IoT devices across Gujarat state.
          </p>
        </div>

        <div className="relative z-10 flex gap-8">
          {[
            { n: "844+", l: "Devices" },
            { n: "33", l: "Districts" },
            { n: "24/7", l: "Monitoring" },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-2xl font-bold text-white">{s.n}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
              <ParkingSquare size={20} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">AI Parking</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-[14px] mb-8">Sign in to your admin dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
                {error}
              </div>
            )}
            <div>
              <label className="text-[13px] font-semibold text-slate-700 mb-2 block">Email</label>
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aiparking.com"
                className="h-11 rounded-xl border-slate-200 text-[14px] focus:border-teal-400 focus:ring-teal-400/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-slate-700 mb-2 block">Password</label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-11 rounded-xl border-slate-200 text-[14px] focus:border-teal-400 focus:ring-teal-400/20 transition-all"
                required
              />
            </div>
            <Button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[14px] font-semibold shadow-lg shadow-teal-600/20 transition-all duration-200 gap-2"
            >
              {loading ? "Signing in..." : <><span>Sign in</span><ArrowRight size={16} /></>}
            </Button>
          </form>

          <p className="text-center text-[12px] text-slate-400 mt-8">
            Contact your administrator for access
          </p>
        </div>
      </div>
    </div>
  );
}
