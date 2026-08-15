import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { MetricCard } from "@/components/MetricCard";
import { 
    ShieldAlert, 
    Ban, 
    UserX, 
    AlertTriangle, 
    ShieldCheck, 
    Database, 
    Lock, 
    Cpu, 
    Clock
} from "lucide-react";

export default function GlobalSecuritySIEM() {
    // Mock Data (No PHI per Zone A Restrictions)
    const securityMetrics = {
        blockedIPs: 12,
        suspendedAccounts: 3,
        unauthorizedAccess: "47 (Last 24h)",
        activeOverrides: 1
    };

    // [OWASP A09] Security Logging and Monitoring Feed.
    const securityIncidents = [
        { id: 1, timestamp: "2026-03-12 11:25:10", type: "Multiple Failed Logins", severity: "warning", ip: "192.168.2.14", facility: "North Wing Hospital" },
        { id: 2, timestamp: "2026-03-12 11:15:05", type: "Unsigned Firmware OTA Attempt", severity: "critical", ip: "10.0.5.22", facility: "System Wide" },
        { id: 3, timestamp: "2026-03-12 10:42:15", type: "Unauthorized API Access Attempt", severity: "critical", ip: "192.168.1.105", facility: "East Wing Hospital" },
        { id: 4, timestamp: "2026-03-12 09:15:00", type: "Successful Firmware OTA Update", severity: "info", ip: "System", facility: "Central IT" },
        { id: 5, timestamp: "2026-03-12 08:45:12", type: "Database Backup Completed", severity: "info", ip: "System", facility: "Central IT" },
    ];

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return <Badge variant="destructive">Critical</Badge>;
            case 'warning': return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Warning</Badge>;
            case 'info': return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">Info</Badge>;
            default: return <Badge variant="outline">Unknown</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight dark:text-teal-100">Global Security Monitoring</h2>
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Aggregated Global Security Metrics. PHI access is restricted in this zone.
                    </p>
                </div>
            </div>

            {/* Section 1: Threat Detection KPIs (Top Row Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="cursor-help">
                                <MetricCard 
                                    title="Blocked IP Addresses" 
                                    value={securityMetrics.blockedIPs} 
                                    icon={Ban} 
                                    statusColor="#f97316" 
                                    className="border-l-4 border-l-orange-500 rounded-none shadow-sm"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-center">
                            <p>IP addresses temporarily banned due to repeated failed login attempts (OWASP A07 Mitigation).</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="cursor-help">
                                <MetricCard 
                                    title="Suspended Accounts" 
                                    value={securityMetrics.suspendedAccounts} 
                                    icon={UserX} 
                                    statusColor="#f59e0b" 
                                    className="border-l-4 border-l-amber-500 rounded-none shadow-sm"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-center">
                            <p>User accounts locked pending administrator review due to suspicious activity.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="cursor-help">
                                <MetricCard 
                                    title="Unauthorized Access Attempts" 
                                    value={securityMetrics.unauthorizedAccess} 
                                    icon={AlertTriangle} 
                                    statusColor="#ef4444" 
                                    className="border-l-4 border-l-red-500 rounded-none shadow-sm"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-center">
                            <p>Attempts to bypass Role-Based Access Control (RBAC) boundaries (OWASP A01).</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="cursor-help">
                    <MetricCard 
                        title="Active Emergency Overrides" 
                        value={securityMetrics.activeOverrides} 
                        icon={ShieldAlert} 
                        statusColor="#dc2626" 
                        className="bg-red-50/50 dark:bg-red-950/20 border-red-200 border-l-4 border-l-red-600 rounded-none shadow-sm"
                    />
                </div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Section 2: Cryptographic & System Integrity (Middle Row - 1/3 width) */}
                {/* // [HIPAA/DPA] Visualization of mandated cryptographic controls. */}
                <Card className="flex flex-col shadow-sm">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
                            <Lock className="w-4 h-4 text-slate-500" />
                            Cryptographic &amp; System Integrity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 px-4 pb-4 pt-0">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Database Encryption (At-Rest)</span>
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none">AES-256 Active</Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Data In-Transit (TLS 1.3)</span>
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none">Secured</Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ESP32 Firmware Signatures</span>
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none">Verified</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 3: Live Security Incident Feed (Middle Row - 2/3 width) */}
                <Card className="lg:col-span-2 border-slate-800 shadow-sm flex flex-col">
                    <CardHeader className="bg-slate-900 border-b border-slate-800 rounded-t-lg py-3 px-4">
                        <CardTitle className="text-slate-100 flex items-center gap-2 text-sm font-medium">
                            <ShieldAlert className="w-4 h-4 text-amber-500" />
                            Live Security Incident Feed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="w-[170px]">Timestamp</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Incident Type</TableHead>
                                    <TableHead>Target/Source IP</TableHead>
                                    <TableHead>Facility Origin</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {securityIncidents.map((event) => (
                                    <TableRow key={event.id} className="hover:bg-slate-50/80">
                                        <TableCell className="font-mono text-xs text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" />
                                                {event.timestamp}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                                        <TableCell className="font-medium text-slate-700">{event.type}</TableCell>
                                        <TableCell className="font-mono text-xs text-slate-600">{event.ip}</TableCell>
                                        <TableCell className="text-sm">{event.facility}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
