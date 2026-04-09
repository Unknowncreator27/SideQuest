import { useState } from "react";
import { Link } from "wouter";
import { Zap, ArrowRight, Eye, EyeOff } from "lucide-react";
import { signInWithGoogle } from "@/lib/firebase";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await signInWithGoogle();

      // Send the Firebase ID token to our backend for authentication
      const response = await fetch("/api/auth/google-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          idToken: result.idToken,
          user: {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Google sign-in failed");
      }

      setSuccess("Welcome back! Redirecting...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? { email: formData.email, password: formData.password, name: formData.name }
        : { email: formData.email, password: formData.password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Authentication failed");
      }

      setSuccess(isRegister ? "Account created! Redirecting..." : "Welcome back! Redirecting...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, oklch(0.08 0.01 260) 0%, oklch(0.1 0.02 280) 100%)",
      }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: "radial-gradient(circle, oklch(0.72 0.22 165), transparent)",
            top: "-10%",
            right: "-5%",
            animation: "pulse 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: "radial-gradient(circle, oklch(0.65 0.22 240), transparent)",
            bottom: "-10%",
            left: "-5%",
            animation: "pulse 8s ease-in-out 4s infinite",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <Link href="/">
          <div className="flex items-center justify-center gap-2 mb-8 cursor-pointer hover:opacity-80 transition">
            <div
              className="p-2 rounded-lg"
              style={{
                background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
              }}
            >
              <Zap size={24} className="text-black" />
            </div>
            <span className="text-2xl font-bold tracking-wider">SIDEQUEST</span>
          </div>
        </Link>

        {/* Form Card */}
        <div
          className="rounded-2xl p-8 backdrop-blur-sm border-2"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            borderColor: "oklch(0.72 0.22 165 / 0.3)",
          }}
        >
          <h1 className="text-2xl font-bold mb-2 text-center">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-sm text-center mb-6 text-gray-400">
            {isRegister ? "Join the quest" : "Continue your journey"}
          </p>

          {/* Error Message */}
          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "rgb(248, 113, 113)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                color: "rgb(134, 239, 172)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Google Sign In Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg border-2 border-gray-600 hover:border-gray-500 bg-black/30 hover:bg-black/50 text-white font-medium flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-gray-400">Or continue with email</span>
                </div>
              </div>
            </div>
            {/* Name (Register only) */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full px-4 py-2 rounded-lg bg-black/30 border-2 text-white placeholder-gray-500 focus:outline-none focus:border-2 transition"
                  style={{
                    borderColor: "oklch(0.72 0.22 165 / 0.3)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "oklch(0.72 0.22 165 / 0.8)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "oklch(0.72 0.22 165 / 0.3)";
                  }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2 rounded-lg bg-black/30 border-2 text-white placeholder-gray-500 focus:outline-none transition"
                style={{
                  borderColor: "oklch(0.72 0.22 165 / 0.3)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.72 0.22 165 / 0.8)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.72 0.22 165 / 0.3)";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={isRegister ? "At least 6 characters" : "Your password"}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 rounded-lg bg-black/30 border-2 text-white placeholder-gray-500 focus:outline-none transition pr-10"
                  style={{
                    borderColor: "oklch(0.72 0.22 165 / 0.3)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "oklch(0.72 0.22 165 / 0.8)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "oklch(0.72 0.22 165 / 0.3)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                color: "oklch(0.08 0.01 260)",
                boxShadow: "0 0 20px oklch(0.72 0.22 165 / 0.4)",
              }}
            >
              {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-400">
              {isRegister ? "Already have an account? " : "New here? "}
            </span>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
                setSuccess("");
              }}
              className="font-bold hover:opacity-80 transition"
              style={{ color: "oklch(0.72 0.22 165)" }}
            >
              {isRegister ? "Sign In" : "Create Account"}
            </button>
          </div>

          {/* Back Home */}
          <Link href="/">
            <button className="w-full mt-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 border-2 border-gray-600 hover:border-gray-500 transition">
              Back Home
            </button>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          🎮 Ready to prove your worth?
        </p>
      </div>
    </div>
  );
}
