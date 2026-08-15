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
import { 
    Activity, 
    ShieldAlert, 
    Wifi, 
    Database, 
    Server, 
    Clock, 
    AlertTriangle, 
    Trash2,
    ShieldCheck
} from "lucide-react";

export default function CommandCenterDashboard() {
    // Mock Data - Aggregated System Telemetry (No PHI per Zone A Restrictions)
    const kpiMetrics = {
        uptime: "99.98%",
        activeOverrides: 1,
        apiLatency: "42ms",
        pendingErasure: 1204
    };

    const fleetStatus = {
        total: 154,
        online: 142,
        offline: 8,
        lowBattery: 4
    };

    const databaseHealth = {
        size: "1.2 TB",
        connections: "245 / 500",
        activeFacilities: 12
    };

    // [OWASP A09] Visualization of Security Logging and Alerting Failures
    const siemFeed = [
        { id: 1, timestamp: "2026-03-12 10:42:15", type: "Failed Admin Login (Brute Force Warning)", severity: "high", ip: "192.168.1.105", status: "Blocked" },
        { id: 2, timestamp: "2026-03-12 10:35:22", type: "Unauthorized API Access Attempt", severity: "high", ip: "10.0.0.52", status: "Blocked" },
        { id: 3, timestamp: "2026-03-12 09:15:00", type: "Successful Firmware OTA Update", severity: "info", ip: "System", status: "Success" },
        { id: 4, timestamp: "2026-03-12 08:45:12", type: "Database Backup Completed", severity: "info", ip: "System", status: "Success" },
        { id: 5, timestamp: "2026-03-12 02:10:05", type: "Multiple Failed Login Attempts", severity: "medium", ip: "172.16.254.1", status: "Warning" },
    ];

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'high': return <Badge variant="destructive">High</Badge>;
            case 'medium': return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Medium</Badge>;
            case 'info': return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">Info</Badge>;
            default: return <Badge variant="outline">Unknown</Badge>;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'Blocked': return <span className="text-red-600 font-medium">{status}</span>;
            case 'Warning': return <span className="text-amber-600 font-medium">{status}</span>;
            case 'Success': return <span className="text-emerald-600 font-medium">{status}</span>;
            default: return <span>{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight dark:text-teal-100">Command Center Dashboard</h2>
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Aggregated Global Telemetry. PHI access is restricted in this zone.
                    </p>
                </div>
            </div>

            {/* Section 1: Critical Operational KPIs (Top Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* System Uptime */}
                <Card className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">System Uptime</CardTitle>
                        <Server className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-slate-800">{kpiMetrics.uptime}</div>
                    </CardContent>
                </Card>

                {/* Active Emergency Access */}
                <Card className="bg-white border border-red-200 border-l-4 border-l-red-500 shadow-sm bg-red-50/50 dark:bg-red-950/20">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-red-800 dark:text-red-400 uppercase tracking-wider">Active Emergency Access</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help"><ShieldAlert className="h-4 w-4 text-red-600" /></div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>HIPAA Guardrail: Indicates an IT administrator currently has used an emergency override to view restricted patient health records.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-red-600">{kpiMetrics.activeOverrides} Active</div>
                    </CardContent>
                </Card>

                {/* Global API Latency */}
                <Card className="bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Global API Latency</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help"><Activity className="h-4 w-4 text-blue-500" /></div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>Average time for the system to process sensor data and trigger the SVM anomaly algorithm.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-slate-800">{kpiMetrics.apiLatency}</div>
                    </CardContent>
                </Card>

                {/* Pending Data Erasure */}
                <Card className="bg-white border border-slate-200 border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                        <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pending Data Erasure</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help"><Trash2 className="h-4 w-4 text-amber-500" /></div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>DPA/GDPR Compliance: Patient records queued for automated deletion based on the 1-year data retention policy.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="text-xl font-bold text-slate-800">{kpiMetrics.pendingErasure.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Section 2: IoT Fleet & Infrastructure (Middle Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hardware Fleet Status */}
                <Card className="shadow-sm">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
                            <Wifi className="w-4 h-4 text-slate-500" />
                            Hardware Fleet Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-500">Total Registered Devices</span>
                                <span className="font-semibold text-lg">{fleetStatus.total}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-3">
                                <span className="text-sm font-medium text-emerald-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online</span>
                                <span className="font-semibold">{fleetStatus.online}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-3">
                                <span className="text-sm font-medium text-slate-500 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Offline</span>
                                <span className="font-semibold">{fleetStatus.offline}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-3">
                                <span className="text-sm font-medium text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Low Battery (&lt;15%)
                                </span>
                                <span className="font-bold text-red-600">{fleetStatus.lowBattery}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Database & Storage Health */}
                <Card className="shadow-sm">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
                            <Database className="w-4 h-4 text-slate-500" />
                            Database &amp; Storage Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-500">Total Database Size</span>
                                <span className="font-semibold text-lg">{databaseHealth.size}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-3">
                                <span className="text-sm font-medium text-slate-600">Connection Pool Utilization</span>
                                <span className="font-semibold">{databaseHealth.connections}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-3">
                                <span className="text-sm font-medium text-slate-600">Active Facilities</span>
                                <span className="font-semibold">{databaseHealth.activeFacilities} Hospitals</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Section 3: SIEM Feed (Bottom Row) */}
            <Card className="border-slate-800 shadow-sm">
                <CardHeader className="bg-slate-900 border-b border-slate-800 rounded-t-lg pb-4">
                    <CardTitle className="text-slate-100 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        Security Information &amp; Event Management (SIEM)
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Live feed of critical infrastructure events and access anomalies.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>Event Type</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {siemFeed.map((event) => (
                                <TableRow key={event.id} className="hover:bg-slate-50/80">
                                    <TableCell className="font-mono text-xs text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            {event.timestamp}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-700">{event.type}</TableCell>
                                    <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-600">{event.ip}</TableCell>
                                    <TableCell>{getStatusText(event.status)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
