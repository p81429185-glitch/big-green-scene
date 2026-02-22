import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, FolderOpen, Share2, Shield, Upload, Users } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Hosting filmów",
    description: "Przesyłaj i przechowuj filmy w wysokiej jakości. Bezpieczne i szybkie.",
  },
  {
    icon: FolderOpen,
    title: "Organizacja",
    description: "Foldery, tagi i wyszukiwanie – znajdź każdy film w sekundę.",
  },
  {
    icon: Share2,
    title: "Udostępnianie",
    description: "Dziel się filmami z drużyną za pomocą linków lub osadzaj je na stronie.",
  },
  {
    icon: Shield,
    title: "Prywatność",
    description: "Kontroluj kto ma dostęp do Twoich filmów. Hasła i ograniczenia.",
  },
  {
    icon: Play,
    title: "Odtwarzacz",
    description: "Elegancki player z dostosowywalnymi ustawieniami i analityką.",
  },
  {
    icon: Users,
    title: "Drużyna",
    description: "Zaproś członków zespołu i zarządzaj uprawnieniami.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Play className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">Big Hosting</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/auth">Zaloguj się</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
              <Link to="/auth?tab=register">Zarejestruj się</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="container mx-auto text-center max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8 backdrop-blur-sm">
            <Play className="h-3.5 w-3.5" />
            Platforma hostingu filmów
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Twoje filmy,
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Twoja kontrola.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-12 max-w-xl mx-auto leading-relaxed">
            Big Hosting to prywatna platforma do hostingu, organizacji i udostępniania filmów
            dla Ciebie i Twojej drużyny.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="text-base px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
              <Link to="/auth?tab=register">Zacznij za darmo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base px-8 border-border/50 hover:bg-card">
              <Link to="/auth">Zaloguj się</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Wszystko czego potrzebujesz
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-lg mx-auto">
            Profesjonalne narzędzia do zarządzania filmami w jednym miejscu.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:bg-card hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Play className="h-3 w-3 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Big Hosting</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Big Hosting. Wszystkie prawa zastrzeżone.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
