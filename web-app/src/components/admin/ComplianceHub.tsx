import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  log_id: string;
  timestamp: string;
  action: string;
  username: string;
  email: string;
  ip_address: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  resource_affected: string;
}

export default function ComplianceHub() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/audit-logs/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Export failed");

      // Convert response to Blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Alaga_Audit_Log_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Audit Report Downloaded");
    } catch (err) {
      toast.error("Failed to generate report");
    }
  };
  // [Secure Fetch]
  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token'); // Or from AuthContext
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/audit-logs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive'; // Red
      case 'WARNING': return 'secondary';    // Yellow/Gray
      default: return 'outline';             // Default
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Compliance & Forensics Hub</h2>
          <p className="text-muted-foreground">
            Audit trail mandated by HIPAA § 164.312(b) and DPA 2012.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export Report (PDF)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Access Logs (Immutable)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p>Loading forensic data...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target Resource</TableHead>
                  <TableHead>Source IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.log_id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(log.severity)}>{log.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.username || 'System'}</span>
                        <span className="text-xs text-muted-foreground">{log.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">{log.action}</TableCell>
                    <TableCell className="font-mono text-xs">{log.resource_affected}</TableCell>
                    <TableCell className="text-xs">{log.ip_address}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}