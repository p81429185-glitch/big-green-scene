import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get("tab") === "register");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-muted/30">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <Play className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">Big Hosting</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isRegister ? "Stwórz konto" : "Witaj ponownie"}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? "Zarejestruj się, aby rozpocząć hosting filmów"
              : "Zaloguj się na swoje konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-4"
          >
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Imię</Label>
                <Input id="name" placeholder="Jan Kowalski" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="jan@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full">
              {isRegister ? "Zarejestruj się" : "Zaloguj się"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? "Masz już konto?" : "Nie masz konta?"}{" "}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary font-medium hover:underline"
            >
              {isRegister ? "Zaloguj się" : "Zarejestruj się"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
