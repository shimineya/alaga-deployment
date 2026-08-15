import { useEffect, useState } from "react";
import {

  Cpu,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SystemStats {
  total_patients: number;
  critical_alerts: number;
  online_devices: number;
  pending_users: number;
  system_status: string;
  uptime: number;
}

export default function SystemOverview() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  // [Secure Fetch] Get stats from the API
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setStats(data.data);
      } else {
        toast.error("Failed to load system vitals");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection Error: Backend unreachable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Optional: Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper to format uptime
  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">System Overview</h2>
          <p className="text-muted-foreground">Real-time operational metrics for Alaga.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          <span>System Operational</span>
        </div>
      </div>

      {/* --- WIDGET GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">



        {/* Widget 2: IoT Devices */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Online Sensors</CardTitle>
            <Cpu className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats?.online_devices}</div>
            <p className="text-xs text-muted-foreground">ESP32 Devices Active</p>
          </CardContent>
        </Card>




      </div>

      {/* --- SERVER HEALTH --- */}
      <Card>
        <CardHeader>
          <CardTitle>Infrastructure Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">API Uptime</p>
              <p className="text-lg font-mono">{loading ? "--" : formatUptime(stats?.uptime || 0)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Database Connection</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm text-emerald-700 font-medium">Healthy</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}