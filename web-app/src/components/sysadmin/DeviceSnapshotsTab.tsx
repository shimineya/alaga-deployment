import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
    Camera, 
    Search, 
    Archive, 
    ArchiveRestore, 
    Trash2, 
    Eye, 
    RefreshCw, 
    Cpu, 
    Activity, 
    ShieldAlert, 
    Clock, 
    Layers,
    FileJson,
    Building2,
    UserCheck
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';

export interface DeviceSnapshot {
    snapshot_id: number;
    device_id: number | null;
    serial_number: string;
    device_name: string | null;
    mac_address: string | null;
    firmware_version: string | null;
    assigned_patient_id: number | null;
    assigned_patient_name: string | null;
    facility_id: number | null;
    facility_name: string | null;
    telemetry_count: number;
    alerts_count: number;
    snapshot_data: any;
    deleted_by: string;
    is_archived: boolean;
    created_at: string;
}

export default function DeviceSnapshotsTab() {
    const { token } = useAuth();
    const [snapshots, setSnapshots] = useState<DeviceSnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [selectedSnapshot, setSelectedSnapshot] = useState<DeviceSnapshot | null>(null);

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
    const getAuth = () => ({
        'Authorization': `Bearer ${token || localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const fetchSnapshots = useCallback(async () => {
        setIsLoading(true);
        try {
            const url = new URL(`${API_BASE}/device-snapshots`);
            if (showArchived) url.searchParams.append('show_archived', 'true');
            if (searchQuery.trim()) url.searchParams.append('search', searchQuery.trim());

            const res = await fetch(url.toString(), { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setSnapshots(data.data || []);
            } else {
                toast.error(data.message || 'Failed to fetch device snapshots');
            }
        } catch {
            toast.error('Network error loading device snapshots');
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE, showArchived, searchQuery, token]);

    useEffect(() => {
        fetchSnapshots();
    }, [fetchSnapshots]);

    const handleToggleArchive = async (snapshot: DeviceSnapshot) => {
        const nextState = !snapshot.is_archived;
        try {
            const res = await fetch(`${API_BASE}/device-snapshots/${snapshot.snapshot_id}/archive`, {
                method: 'PATCH',
                headers: getAuth(),
                body: JSON.stringify({ is_archived: nextState })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || (nextState ? 'Snapshot archived.' : 'Snapshot restored.'));
                fetchSnapshots();
            } else {
                toast.error(data.message || 'Failed to update snapshot status');
            }
        } catch {
            toast.error('Network error during archiving');
        }
    };

    const handleDeleteSnapshot = async (snapshotId: number) => {
        if (!confirm('Are you sure you want to permanently delete this device snapshot record? This cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/device-snapshots/${snapshotId}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Device snapshot record deleted permanently.');
                fetchSnapshots();
            } else {
                toast.error(data.message || 'Failed to delete snapshot');
            }
        } catch {
            toast.error('Network error during snapshot deletion');
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col space-y-4 min-h-0">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-teal-600" />
                        <h2 className="text-base font-bold text-slate-800">Permanent Device Snapshots</h2>
                        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">
                            {snapshots.length} Snapshots
                        </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Immutable historical snapshots created automatically upon permanent device deletion.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-48 sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search serial, device, ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
                        />
                    </div>

                    <Button
                        variant={showArchived ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowArchived(!showArchived)}
                        className="h-8 text-xs font-semibold gap-1.5"
                    >
                        <Archive className="w-3.5 h-3.5" />
                        {showArchived ? "Archived Snapshots" : "Active Snapshots"}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchSnapshots}
                        className="h-8 w-8 text-slate-500 hover:text-slate-800"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Snapshots Table / List */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
                <CardContent className="p-0 flex-1 overflow-auto">
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                        </div>
                    ) : snapshots.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <Camera className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-700">No Device Snapshots Found</h3>
                            <p className="text-xs text-slate-400 max-w-sm">
                                {searchQuery ? "No snapshots match your search term." : "Snapshots will appear here whenever a hardware device is permanently deleted from the system."}
                            </p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                            <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">Snapshot ID</th>
                                    <th className="px-4 py-3">Device & Serial</th>
                                    <th className="px-4 py-3">Last Assignment</th>
                                    <th className="px-4 py-3">Facility</th>
                                    <th className="px-4 py-3 text-center">Telemetry Collected</th>
                                    <th className="px-4 py-3 text-center">Alerts</th>
                                    <th className="px-4 py-3">Deleted By</th>
                                    <th className="px-4 py-3">Snapshot Timestamp</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                {snapshots.map((snap) => (
                                    <tr key={snap.snapshot_id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                            #{snap.snapshot_id}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 font-mono text-[11px]">
                                                    {snap.serial_number}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {snap.device_name || 'Generic ESP32 Sensor'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {snap.assigned_patient_id ? (
                                                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                                    <UserCheck className="w-3 h-3 text-teal-600 shrink-0" />
                                                    <span>{snap.assigned_patient_name || `Patient #${snap.assigned_patient_id}`}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Unassigned at deletion</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span>{snap.facility_name || 'Home / Standalone'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800">
                                            {snap.telemetry_count.toLocaleString()} samples
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {snap.alerts_count > 0 ? (
                                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-mono">
                                                    {snap.alerts_count} alerts
                                                </Badge>
                                            ) : (
                                                <span className="text-[10px] text-slate-400">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500 font-mono">
                                            {snap.deleted_by || 'System Admin'}
                                        </td>
                                        <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">
                                            {new Date(snap.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setSelectedSnapshot(snap)}
                                                    className="w-7 h-7 border-slate-200 hover:bg-slate-50 text-slate-600"
                                                    title="View Full Snapshot Payload"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleToggleArchive(snap)}
                                                    className="w-7 h-7 border-slate-200 hover:bg-slate-50 text-slate-600"
                                                    title={snap.is_archived ? "Restore Snapshot" : "Archive Snapshot"}
                                                >
                                                    {snap.is_archived ? (
                                                        <ArchiveRestore className="w-3.5 h-3.5 text-teal-600" />
                                                    ) : (
                                                        <Archive className="w-3.5 h-3.5 text-slate-500" />
                                                    )}
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleDeleteSnapshot(snap.snapshot_id)}
                                                    className="w-7 h-7 border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-red-600"
                                                    title="Permanently Delete Snapshot"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* Snapshot Detail Modal */}
            <Dialog open={!!selectedSnapshot} onOpenChange={() => setSelectedSnapshot(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <FileJson className="w-4 h-4 text-teal-600" />
                            Device Snapshot Ledger #{selectedSnapshot?.snapshot_id}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Serial Number: <span className="font-mono font-bold text-slate-700">{selectedSnapshot?.serial_number}</span> | Captured: {selectedSnapshot ? new Date(selectedSnapshot.created_at).toLocaleString() : ''}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSnapshot && (
                        <div className="space-y-4 flex-1 overflow-auto pr-1">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Device Name</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedSnapshot.device_name || 'N/A'}</p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Telemetry Count</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedSnapshot.telemetry_count.toLocaleString()}</p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Recorded Alerts</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedSnapshot.alerts_count}</p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Facility</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{selectedSnapshot.facility_name || 'None'}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-teal-600" />
                                    Immutable Forensic Snapshot JSON
                                </p>
                                <pre className="p-3 bg-slate-900 text-teal-300 rounded-lg text-[11px] font-mono overflow-auto max-h-72 border border-slate-800">
                                    {JSON.stringify(selectedSnapshot.snapshot_data, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
