"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Bell, Shield, Database, Palette, Globe, Key, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ProjectSettingsCard } from "@/components/project/ProjectSettingsCard";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    slack: false,
    sms: false,
    criticalOnly: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Manage your dashboard preferences and configurations</p>
        </div>

        <ProjectSettingsCard />

        {/* Profile Settings */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Profile Settings
            </CardTitle>
            <CardDescription>Manage your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" defaultValue="Admin User" className="bg-muted/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="admin@voiceai.com" className="bg-muted/50 border-border/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select defaultValue="admin">
                <SelectTrigger className="bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-chart-warning" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Configure how you receive alerts and updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive alerts via email</p>
              </div>
              <Switch 
                checked={notifications.email} 
                onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
              />
            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>Slack Integration</Label>
                <p className="text-sm text-muted-foreground">Send alerts to Slack channel</p>
              </div>
              <Switch 
                checked={notifications.slack} 
                onCheckedChange={(checked) => setNotifications({...notifications, slack: checked})}
              />
            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>SMS Alerts</Label>
                <p className="text-sm text-muted-foreground">Critical alerts via SMS</p>
              </div>
              <Switch 
                checked={notifications.sms} 
                onCheckedChange={(checked) => setNotifications({...notifications, sms: checked})}
              />
            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>Critical Alerts Only</Label>
                <p className="text-sm text-muted-foreground">Only receive high-priority notifications</p>
              </div>
              <Switch 
                checked={notifications.criticalOnly} 
                onCheckedChange={(checked) => setNotifications({...notifications, criticalOnly: checked})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-chart-success" />
              Security
            </CardTitle>
            <CardDescription>Manage authentication and security options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm">Enable 2FA</Button>
            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>Session Timeout</Label>
                <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
              </div>
              <Select defaultValue="30">
                <SelectTrigger className="w-32 bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* API & Integrations */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              API & Integrations
            </CardTitle>
            <CardDescription>Manage API keys and external integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input 
                  type="password" 
                  defaultValue="sk-xxxx-xxxx-xxxx-xxxx" 
                  className="bg-muted/50 border-border/50 font-mono"
                  readOnly
                />
                <Button variant="outline">Regenerate</Button>
              </div>
            </div>
            <Separator className="bg-border/50" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="font-medium">Azure OpenAI</span>
                  </div>
                  <span className="text-xs text-chart-success">Connected</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="font-medium">Twilio</span>
                  </div>
                  <span className="text-xs text-chart-success">Connected</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Palette className="w-4 h-4 text-chart-4" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the dashboard look and feel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
              </div>
              <Select
                value={mounted ? (theme ?? "dark") : "dark"}
                onValueChange={setTheme}
                disabled={!mounted}
              >
                <SelectTrigger className="w-32 bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>

            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>Timezone</Label>
                <p className="text-sm text-muted-foreground">Display times in your local timezone</p>
              </div>
              <Select defaultValue="utc">
                <SelectTrigger className="w-40 bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utc">UTC</SelectItem>
                  <SelectItem value="est">EST (UTC-5)</SelectItem>
                  <SelectItem value="pst">PST (UTC-8)</SelectItem>
                  <SelectItem value="ist">IST (UTC+5:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
