import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");
  const verifyMutation = trpc.auth.verifyEmail.useMutation();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    verifyMutation.mutate(
      { token },
      {
        onSuccess: () => {
          setStatus("success");
          setMessage("Email verified successfully! You can now log in.");
          setTimeout(() => setLocation("/login"), 3000);
        },
        onError: (error: any) => {
          setStatus("error");
          setMessage(error.message || "Failed to verify email");
        },
      }
    );
  }, [token, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
          <CardDescription>
            Verifying your email address...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Please wait while we verify your email...</p>
            </div>
          )}

          {status === "success" && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/")}
            >
              Go Home
            </Button>
            <Button
              className="flex-1"
              onClick={() => setLocation("/login")}
            >
              Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}