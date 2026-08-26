import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    Clock,
    RefreshCw,
    Search,
    X,
    Flame
} from "lucide-react";
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface SecurityIncident {
    timestamp: string;
    action: string;
    severity: string;
    resource_affected: string;
    username: string;
    ip_address: string;
}

interface SecurityMetrics {
    blocked_ips: number;
    suspended_accounts: number;
    unauthorized_attempts: number;
    active_overrides: number;
    global_lockdown: boolean;
}

export default function GlobalSecuritySIEM() {
    const { token } = useAuth();
    
    // States
    const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLockdownPending, setIsLockdownPending] = useState(false);

    // Search & Suggestions States
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
    const getHeaders = () => ({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    });

    const fetchSecurityData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            // 1. Fetch real-time security stats
            const statsRes = await fetch(`${API_BASE}/stats/security`, { headers: getHeaders() });
            const statsData = await statsRes.json();
            if (statsData.success) {
                setMetrics(statsData.data);
            }

            // 2. Fetch security incidents (from events endpoint)
            const eventsRes = await fetch(`${API_BASE}/security-events`, { headers: getHeaders() });
            const eventsData = await eventsRes.json();
            if (eventsData.success) {
                setIncidents(eventsData.data || []);
            }
        } catch (err) {
            toast.error("Failed to synchronize Security operations data.");
            console.error("SIEM Sync Error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchSecurityData();
        }
    }, [token]);

    // Handle Click Outside for Suggestions Dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter Incidents List
    const filteredIncidents = useMemo(() => {
        return incidents.filter(incident => 
            (incident.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (incident.ip_address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (incident.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (incident.resource_affected || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [incidents, searchQuery]);

    // Trigger Kill Switch (Global Lockdown)
    const handleToggleLockdown = async () => {
        if (!metrics) return;
        const nextState = !metrics.global_lockdown;

        const confirmationMsg = nextState 
            ? "WARNING: Enabling Global Lockdown will instantly force-logout all non-administrator users, lock their accounts, and place the server in maintenance mode. Are you sure you want to proceed?"
            : "Are you sure you want to lift the global lockdown and restore normal server operations?";

        if (!window.confirm(confirmationMsg)) {
            return;
        }

        setIsLockdownPending(true);
        try {
            const res = await fetch(`${API_BASE}/kill-switch/global-lockdown`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ enabled: nextState })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchSecurityData(true);
            } else {
                toast.error(data.message || "Failed to trigger lockdown operation.");
            }
        } catch {
            toast.error("Network error: Failed to trigger lockdown.");
        } finally {
            setIsLockdownPending(false);
        }
    };

    const getSeverityBadge = (severity: string) => {
        const s = severity?.toLowerCase();
        switch (s) {
            case 'critical':
            case 'high': 
                return <Badge variant="destructive">Critical</Badge>;
            case 'warning':
            case 'medium': 
                return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Warning</Badge>;
            case 'info': 
                return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">Info</Badge>;
            default: 
                return <Badge variant="outline">Info</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-2">
                <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
                <p className="text-xs text-slate-500">Synchronizing security operations telemetry...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Global Security Monitoring</h2>
                    <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Aggregated Global Security Metrics. PHI access is restricted in this zone.
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isRefreshing}
                    onClick={() => fetchSecurityData(true)}
                    className="h-8 text-xs font-semibold"
                >
                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Sync SIEM
                </Button>
            </div>

            {/* Section 1: Threat Detection KPIs (Top Row Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="cursor-help">
                                <MetricCard 
                                    title="Blocked IP Addresses" 
                                    value={metrics ? metrics.blocked_ips : 0} 
                                    icon={Ban} 
                                    statusColor="#f97316" 
                                    className="border-l-4 border-l-orange-500 rounded-none shadow-sm bg-white"
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
                                    value={metrics ? metrics.suspended_accounts : 0} 
                                    icon={UserX} 
                                    statusColor="#f59e0b" 
                                    className="border-l-4 border-l-amber-500 rounded-none shadow-sm bg-white"
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
                                    value={metrics ? `${metrics.unauthorized_attempts} (Last 24h)` : "0 (Last 24h)"} 
                                    icon={AlertTriangle} 
                                    statusColor="#ef4444" 
                                    className="border-l-4 border-l-red-500 rounded-none shadow-sm bg-white"
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
                        title="Active Break-Glass Overrides" 
                        value={metrics ? metrics.active_overrides : 0} 
                        icon={ShieldAlert} 
                        statusColor="#dc2626" 
                        className="bg-red-50/50 border-red-200 border-l-4 border-l-red-600 rounded-none shadow-sm"
                    />
                </div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Section 2: Cryptographic & System Integrity (Middle Row - 1/3 width) */}
                <div className="space-y-6">
                    <Card className="flex flex-col shadow-sm bg-white border border-slate-200">
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
                                        <span className="text-xs font-medium text-slate-700">Database Encryption</span>
                                    </div>
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none text-[10px]">AES-256 Active</Badge>
                                </div>
                                
                                <div className="flex items-center justify-between border-t pt-3">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                                        <span className="text-xs font-medium text-slate-700">In-Transit (TLS 1.3)</span>
                                    </div>
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none text-[10px]">Secured</Badge>
                                </div>
                                
                                <div className="flex items-center justify-between border-t pt-3">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="w-4 h-4 text-slate-500" />
                                        <span className="text-xs font-medium text-slate-700">Firmware Signatures</span>
                                    </div>
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none text-[10px]">ECDSA Verified</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Kill Switch Card */}
                    <Card className={`flex flex-col shadow-sm border border-slate-200 ${metrics?.global_lockdown ? 'bg-rose-50 border-rose-300' : 'bg-white'}`}>
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
                                <Flame className="w-4 h-4 text-rose-500" />
                                Emergency System Kill-Switch
                            </CardTitle>
                            <CardDescription className="text-[10px]">
                                Lockdown server traffic and disable logins during an active breach.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <Button
                                disabled={isLockdownPending}
                                onClick={handleToggleLockdown}
                                className={`w-full text-xs font-bold py-2 ${metrics?.global_lockdown 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-100'}`}
                            >
                                {isLockdownPending 
                                    ? 'Executing Operation...' 
                                    : metrics?.global_lockdown 
                                        ? 'Deactivate System Lockdown' 
                                        : 'ACTIVATE GLOBAL LOCKDOWN'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Section 3: Live Security Incident Feed (Middle Row - 2/3 width) */}
                <Card className="lg:col-span-2 border-slate-800 shadow-sm flex flex-col bg-white">
                    <CardHeader className="bg-slate-900 border-b border-slate-800 rounded-t-lg py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="text-slate-100 flex items-center gap-2 text-sm font-medium">
                            <ShieldAlert className="w-4 h-4 text-amber-500" />
                            Live Security Incident Feed
                        </CardTitle>
                        
                        {/* Search bar inside header */}
                        <div className="relative w-full sm:w-56" ref={searchRef}>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search incidents..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    className="w-full text-xs pl-8 pr-6 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
                                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </button>
                                )}
                            </div>

                            {showSuggestions && searchQuery && (
                                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-800">
                                    {incidents.filter(i => 
                                        (i.action || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        (i.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (i.ip_address || '').toLowerCase().includes(searchQuery.toLowerCase())
                                    ).length === 0 ? (
                                        <div className="p-2 text-[10px] text-slate-550 italic text-slate-400">No matches</div>
                                    ) : (
                                        incidents
                                            .filter(i => 
                                                (i.action || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                (i.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (i.ip_address || '').toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((incident, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        setSearchQuery(incident.action || '');
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors font-medium flex justify-between bg-slate-900 border-none outline-none"
                                                >
                                                    <span className="truncate max-w-[120px]">{incident.action || 'Incident'}</span>
                                                    <span className="font-mono text-slate-500 text-[9px]">{incident.username || 'System'}</span>
                                                </button>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="w-[170px] text-xs">Timestamp</TableHead>
                                    <TableHead className="text-xs">Severity</TableHead>
                                    <TableHead className="text-xs">Incident Type</TableHead>
                                    <TableHead className="text-xs">Target/Source IP</TableHead>
                                    <TableHead className="text-xs">Facility Origin</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredIncidents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400 italic">
                                            No incidents match search query.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredIncidents.map((event, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/80 text-xs">
                                            <TableCell className="font-mono text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    {new Date(event.timestamp).toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                                            <TableCell className="font-medium text-slate-700">{event.action || 'System Incident'}</TableCell>
                                            <TableCell className="font-mono text-slate-600">{event.ip_address || 'Localhost'}</TableCell>
                                            <TableCell className="text-slate-600">{event.resource_affected || 'Global Core'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
