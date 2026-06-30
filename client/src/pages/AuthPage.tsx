import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, User, Lock } from "lucide-react";
import { motion } from "framer-motion";

function GeometricShape({ size, x, y, delay = 0, duration = 20, spikes = 16 }: {
  size: number; x: string; y: string; delay?: number; duration?: number; spikes?: number;
}) {
  const points = Array.from({ length: spikes * 2 }, (_, i) => {
    const angle = (i * Math.PI) / spikes;
    const r = i % 2 === 0 ? size : size * 0.55;
    const px = Math.cos(angle - Math.PI / 2) * r;
    const py = Math.sin(angle - Math.PI / 2) * r;
    return `${px},${py}`;
  }).join(" ");

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear", delay }}
    >
      <svg width={size * 2} height={size * 2} viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}>
        <polygon
          points={points}
          fill="none"
          stroke="rgba(180,100,255,0.45)"
          strokeWidth="1.5"
        />
      </svg>
    </motion.div>
  );
}

function FloatingParticle({ x, y, delay }: { x: string; y: string; delay: number }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
      style={{ left: x, top: y, background: "rgba(249,115,22,0.5)" }}
      animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
      transition={{ duration: 4 + delay, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

export default function AuthPage() {
  const { loginMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({ username: "", password: "" });

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  if (user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1a0533 0%, #2d0a52 30%, #3d1070 60%, #4a1480 100%)",
      }}
    >
      {/* Animated background blobs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(107,33,168,0.25) 0%, transparent 70%)",
          top: "10%", left: "5%",
        }}
        animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)",
          bottom: "5%", right: "10%",
        }}
        animate={{ scale: [1, 1.2, 1], x: [0, -20, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Geometric Shapes */}
      <GeometricShape size={130} x="78%" y="30%" delay={0} duration={28} spikes={20} />
      <GeometricShape size={85} x="85%" y="65%" delay={4} duration={22} spikes={16} />
      <GeometricShape size={55} x="72%" y="72%" delay={2} duration={18} spikes={12} />
      <GeometricShape size={40} x="90%" y="20%" delay={6} duration={16} spikes={10} />
      <GeometricShape size={60} x="8%" y="20%" delay={3} duration={24} spikes={12} />
      <GeometricShape size={35} x="15%" y="75%" delay={7} duration={20} spikes={8} />

      {/* Floating particles (orange — Zain accent) */}
      {[
        { x: "20%", y: "30%" }, { x: "75%", y: "15%" }, { x: "60%", y: "80%" },
        { x: "40%", y: "60%" }, { x: "88%", y: "50%" }, { x: "12%", y: "55%" },
        { x: "50%", y: "10%" }, { x: "30%", y: "85%" },
      ].map((p, i) => (
        <FloatingParticle key={i} x={p.x} y={p.y} delay={i * 0.7} />
      ))}

      {/* Subtle horizontal lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[15, 35, 55, 75, 90].map((top, i) => (
          <motion.div
            key={i}
            className="absolute h-px w-full"
            style={{
              top: `${top}%`,
              background: "linear-gradient(90deg, transparent 0%, rgba(180,80,255,0.07) 50%, transparent 100%)",
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.8 }}
          />
        ))}
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div
          className="rounded-2xl p-10 shadow-2xl"
          style={{
            background: "rgba(30, 5, 60, 0.60)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(180,80,255,0.22)",
            boxShadow: "0 8px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1
              className="text-5xl font-black tracking-widest text-white uppercase mb-1"
              style={{ letterSpacing: "0.18em", textShadow: "0 0 30px rgba(180,80,255,0.4)" }}
            >
              ZLINGO
            </h1>
            <p className="text-xs font-medium mt-1" style={{ color: "rgba(249,115,22,0.85)", letterSpacing: "0.25em" }}>
              ZAIN JORDAN · LEARNING PLATFORM
            </p>
            <div
              className="h-0.5 w-20 mx-auto mt-3 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.9), transparent)" }}
            />
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(180,80,255,0.7)" }} />
                <input
                  type="text"
                  placeholder="Employee ID"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  required
                  data-testid="input-username"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white placeholder-purple-300/40 outline-none transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(180,80,255,0.22)",
                    fontSize: "0.95rem",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = "1px solid rgba(249,115,22,0.7)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.12)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = "1px solid rgba(180,80,255,0.22)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(180,80,255,0.7)" }} />
                <input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  data-testid="input-password"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white placeholder-purple-300/40 outline-none transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(180,80,255,0.22)",
                    fontSize: "0.95rem",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = "1px solid rgba(249,115,22,0.7)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.12)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = "1px solid rgba(180,80,255,0.22)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </motion.div>

            {/* Submit */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="pt-2"
            >
              <button
                type="submit"
                disabled={loginMutation.isPending}
                data-testid="button-login"
                className="w-full py-3.5 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-300 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                  color: "white",
                  border: "1px solid rgba(249,115,22,0.35)",
                  boxShadow: "0 4px 20px rgba(107,33,168,0.4)",
                  letterSpacing: "0.15em",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "linear-gradient(135deg, #f97316, #ea580c)";
                  e.currentTarget.style.boxShadow = "0 6px 28px rgba(249,115,22,0.45)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #9333ea)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(107,33,168,0.4)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" /> Signing in...
                  </span>
                ) : "LOGIN"}
              </button>
            </motion.div>

            {loginMutation.isError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-red-400 text-sm mt-2"
                data-testid="text-login-error"
              >
                Invalid credentials. Please try again.
              </motion.p>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
