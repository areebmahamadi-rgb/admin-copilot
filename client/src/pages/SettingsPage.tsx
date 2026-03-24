import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Mail, MessageSquare, CheckSquare, Calendar } from "lucide-react";
import { toast } from "sonner";

const integrations = [
  { name: "Gmail", icon: Mail, status: "connected" as const, description: "Email triage and draft replies" },
  { name: "Slack", icon: MessageSquare, status: "pending" as const, description: "Channel and DM triage" },
  { name: "Asana", icon: CheckSquare, status: "connected" as const, description: "Task prioritization" },
  { name: "Google Calendar", icon: Calendar, status: "connected" as const, description: "Daily schedule overview" },
];

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="font-headline text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      {/* Profile */}
      <section className="mb-8">
        <h2 className="font-headline text-lg font-semibold text-foreground mb-3">Profile</h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-headline text-lg font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground font-body">{user?.name}</p>
                <p className="text-sm text-muted-foreground font-body">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Integrations */}
      <section className="mb-8">
        <h2 className="font-headline text-lg font-semibold text-foreground mb-3">Integrations</h2>
        <div className="space-y-2">
          {integrations.map((int) => (
            <Card key={int.name}>
              <CardContent className="p-4 flex items-center gap-4">
                <int.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground font-body">{int.name}</p>
                  <p className="text-xs text-muted-foreground font-body">{int.description}</p>
                </div>
                <Badge variant={int.status === "connected" ? "default" : "secondary"} className="shrink-0">
                  {int.status === "connected" ? "Connected" : "Needs Auth"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Triage Rules */}
      <section>
        <h2 className="font-headline text-lg font-semibold text-foreground mb-3">Triage Rules</h2>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground font-body">
              Rule customization is coming soon. Currently using default noise filters for newsletters, automated notifications, and cold outreach.
            </p>
            <button
              className="mt-3 text-sm text-primary hover:underline font-body"
              onClick={() => toast("Feature coming soon")}
            >
              View current rules
            </button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
