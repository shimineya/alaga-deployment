import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
import { toast } from 'sonner';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '../ui/dialog';
import { 
    Search, 
    RefreshCw, 
    Archive, 
    Trash2, 
    RotateCcw, 
    Filter,
    Building2,
    ShieldAlert,
    Clock,
    UserCheck,
    Cpu,
    Calendar,
    Users,
    Activity,
    Layers
} from 'lucide-react';

interface ArchiveRecord {
    archive_id: number;
    entity_type: string;
    target_id: string;
    target_name: string;
    archived_at: string;
    status: string;
    facility_id: number | null;
    facility_name: string | null;
    archived_by_name: string | null;
}

export default function ArchiveHub() {
    const { user, token } = useAuth();
    const { t } = useCaregiverLanguage();
    const role = user?.role?.toLowerCase() || '';
    const isSysAdmin = ['system_admin', 'admin', 'sysadmin'].includes(role);

    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    // Confirm Hard Delete Modal State
    const [deleteRecord, setDeleteRecord] = useState<ArchiveRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Unarchive Actions Loading States
    const [unarchivingId, setUnarchivingId] = useState<number | null>(null);

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_BASE}/api/archives`, {
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setRecords(data.data);
            } else {
                toast.error(data.message || 'Failed to load archived records.');
            }
        } catch (err) {
            console.error('Fetch archives error:', err);
            toast.error('Network error loading archives.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleUnarchive = async (record: ArchiveRecord) => {
        setUnarchivingId(record.archive_id);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_BASE}/api/archives/${record.archive_id}/unarchive`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`${record.entity_type} "${record.target_name}" restored successfully.`);
                setRecords(prev => prev.filter(r => r.archive_id !== record.archive_id));
            } else {
                toast.error(data.message || 'Failed to restore record.');
            }
        } catch (err) {
            console.error('Unarchive error:', err);
            toast.error('Network error restoring record.');
        } finally {
            setUnarchivingId(null);
        }
    };

    const handleHardDelete = async () => {
        if (!deleteRecord) return;
        setIsDeleting(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_BASE}/api/archives/${deleteRecord.archive_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`${deleteRecord.entity_type} "${deleteRecord.target_name}" has been permanently deleted.`);
                setRecords(prev => prev.filter(r => r.archive_id !== deleteRecord.archive_id));
                setDeleteRecord(null);
            } else {
                toast.error(data.message || 'Failed to permanently delete record.');
            }
        } catch (err) {
            console.error('Hard delete error:', err);
            toast.error('Network error performing permanent delete.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter and search computation
    const filteredRecords = records.filter(rec => {
        const matchesSearch = 
            rec.target_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rec.target_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rec.archive_id.toString().includes(searchQuery);
        
        const matchesType = typeFilter === 'ALL' || rec.entity_type.toUpperCase() === typeFilter.toUpperCase();

        return matchesSearch && matchesType;
    });

    const getEntityIcon = (type: string) => {
        switch (type) {
            case 'User': return <Users className="w-4 h-4 text-sky-500" />;
            case 'Patient': return <UserCheck className="w-4 h-4 text-emerald-500" />;
            case 'Device': return <Cpu className="w-4 h-4 text-purple-500" />;
            case 'Facility': return <Building2 className="w-4 h-4 text-amber-500" />;
            case 'Schedule': return <Calendar className="w-4 h-4 text-rose-500" />;
            case 'Announcement': return <ShieldAlert className="w-4 h-4 text-orange-500" />;
            case 'Clinical Alert': return <Activity className="w-4 h-4 text-rose-500" />;
            case 'System Alert': return <Cpu className="w-4 h-4 text-amber-500" />;
            case 'Firmware': return <RefreshCw className="w-4 h-4 text-sky-500" />;
            case 'IP Ban': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
            case 'Assignment': return <Layers className="w-4 h-4 text-teal-500" />;
            default: return <Archive className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col gap-6">
            {/* Header section with Scoping Message */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Archive className="w-6 h-6 text-teal-600 animate-pulse" />
                        {isSysAdmin ? t('Global Archive Hub', 'Global Archive Hub') : t('Facility Archive Hub', 'Hub ng Archive ng Pasilidad')}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isSysAdmin 
                            ? t('Authorized under omniscient system-admin permissions. Reviewing and restoring archived resources across all facilities.', 'Pinahintulutan sa ilalim ng omniscient system-admin permissions. Sinusuri at pinapanumbalik ang mga naka-archive na mapagkukunan sa lahat ng pasilidad.')
                            : t('Viewing and managing archived patients, devices, and staff accounts scoped exclusively to your assigned facility.', 'Tinitingnan at pinamamahalaan ang mga naka-archive na pasyente, device, at account ng staff na eksklusibong nakapaloob sa iyong nakatalagang pasilidad.')
                        }
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchRecords} 
                    disabled={isLoading}
                    className="flex items-center gap-2 hover:bg-slate-100/50 hover:text-slate-800 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('Refresh', 'I-refresh')}
                </Button>
            </div>

            {/* Main Content card */}
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-xl">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">{t('Archived Items Directory', 'Direktoryo ng mga Naka-archive na Item')}</CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-0.5">{t('Manage soft-deleted system entities. Recover or permanently delete them.', 'Pamahalaan ang mga soft-deleted na system entity. Ibalik o permanenteng burahin ang mga ito.')}</CardDescription>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder={t('Search by Name/ID...', 'Maghanap sa Pangalan/ID...')}
                                    className="pl-9 w-full sm:w-[220px] h-9 text-xs"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <select 
                                    className="h-9 w-full sm:w-[150px] border border-slate-200 bg-white rounded-lg px-2.5 text-xs text-slate-600 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                >
                                    <option value="ALL">{t('All Entity Types', 'Lahat ng Uri')}</option>
                                    <option value="USER">{t('Users / Staff', 'Mga User / Staff')}</option>
                                    <option value="PATIENT">{t('Patients', 'Mga Pasyente')}</option>
                                    <option value="DEVICE">{t('Devices', 'Mga Device')}</option>
                                    {isSysAdmin && <option value="FACILITY">{t('Facilities', 'Mga Pasilidad')}</option>}
                                    <option value="SCHEDULE">{t('Schedules', 'Mga Iskedyul')}</option>
                                    <option value="ANNOUNCEMENT">{t('Announcements', 'Mga Anunsyo')}</option>
                                    <option value="CLINICAL ALERT">{t('Clinical Alerts', 'Mga Alerto sa Klinikal')}</option>
                                    <option value="SYSTEM ALERT">{t('System Alerts', 'Mga Alerto sa Hardware')}</option>
                                    {isSysAdmin && <option value="FIRMWARE">{t('Firmware Updates', 'Firmware Updates')}</option>}
                                    {isSysAdmin && <option value="IP BAN">{t('Banned IPs', 'Banned IPs')}</option>}
                                    {isSysAdmin && <option value="ASSIGNMENT">{t('Care Assignments', 'Mga Care Assignment')}</option>}
                                </select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                    <th className="py-4 px-6">{t('Archive ID', 'Archive ID')}</th>
                                    <th className="py-4 px-4">{t('Entity Type', 'Uri ng Entity')}</th>
                                    <th className="py-4 px-4">{t('Target ID / Name', 'Target ID / Pangalan')}</th>
                                    {isSysAdmin && <th className="py-4 px-4">{t('Facility Scoping', 'Sakop ng Pasilidad')}</th>}
                                    <th className="py-4 px-4">{t('Archived By', 'In-archive Ni')}</th>
                                    <th className="py-4 px-4">{t('Archived At', 'In-archive Noong')}</th>
                                    <th className="py-4 px-4">{t('Status', 'Katayuan')}</th>
                                    <th className="py-4 px-6 text-right">{t('Actions', 'Mga Aksyon')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={isSysAdmin ? 8 : 7} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Archive className="w-8 h-8 text-slate-300" />
                                                <p className="font-semibold text-sm">{t('No archived items found.', 'Walang nahanap na naka-archive na item.')}</p>
                                                <p className="text-xs text-slate-400">{t('Archived entries will appear here.', 'Dito lalabas ang mga in-archive na entry.')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record) => (
                                        <tr key={record.archive_id} className="hover:bg-slate-50/40 transition-colors group">
                                            <td className="py-4 px-6 font-mono text-[10px] text-slate-500 font-bold">
                                                #{record.archive_id}
                                            </td>
                                            <td className="py-4 px-4 font-semibold">
                                                <div className="flex items-center gap-2">
                                                    {getEntityIcon(record.entity_type)}
                                                    <span>{record.entity_type}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="font-semibold text-slate-900">{record.target_name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID/Serial: {record.target_id}</div>
                                            </td>
                                            {isSysAdmin && (
                                                <td className="py-4 px-4">
                                                    {record.facility_name ? (
                                                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                            {record.facility_name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">{t('Global / System', 'Pang-sistema')}</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="py-4 px-4 text-slate-600">
                                                {record.archived_by_name ? (
                                                    <span className="font-medium">@{record.archived_by_name}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic">system</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                                                    {new Date(record.archived_at).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded shadow-none hover:bg-amber-500/15">
                                                    {record.status}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleUnarchive(record)}
                                                        disabled={unarchivingId === record.archive_id}
                                                        className="h-8 px-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 flex items-center gap-1 text-[11px] font-semibold border border-teal-200/50 hover:border-teal-300"
                                                    >
                                                        <RotateCcw className={`w-3.5 h-3.5 ${unarchivingId === record.archive_id ? 'animate-spin' : ''}`} />
                                                        {t('Restore', 'Ibalik')}
                                                    </Button>
                                                    
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleteRecord(record)}
                                                        className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1 text-[11px] font-semibold border border-red-200/50 hover:border-red-300"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        {t('Delete', 'Burahin')}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Hard Delete Confirmation Dialog */}
            <Dialog open={!!deleteRecord} onOpenChange={(open) => !open && setDeleteRecord(null)}>
                <DialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-xl">
                    <DialogHeader className="p-6">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-lg font-bold text-slate-900">
                            {t('Confirm Permanent Erasure', 'Kumpirmahin ang Permanenteng Pagbura')}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 mt-2">
                            {t('Are you sure you want to permanently erase the following resource? This action cannot be undone and will completely wipe all historical logs, profiles, and associated database entries for this record.',
                               'Sigurado ka bang gusto mong permanenteng burahin ang sumusunod na mapagkukunan? Ang aksyong ito ay hindi na maaaring bawiin at ganap na bubura sa lahat ng makasaysayang log, profile, at nauugnay na database entry para sa rekord na ito.')}
                        </DialogDescription>
                    </DialogHeader>

                    {deleteRecord && (
                        <div className="px-6 py-4 bg-slate-50 border-y border-slate-100 flex flex-col gap-1.5 text-xs text-slate-700">
                            <div>
                                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block">{t('Entity Type', 'Uri ng Entity')}</span>
                                <span className="font-bold text-slate-800">{deleteRecord.entity_type}</span>
                            </div>
                            <div className="mt-2">
                                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block">{t('Target Name', 'Target na Pangalan')}</span>
                                <span className="font-bold text-slate-800">{deleteRecord.target_name}</span>
                            </div>
                            <div className="mt-2">
                                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block">{t('Reference ID', 'Reference ID')}</span>
                                <span className="font-mono text-slate-600 font-bold">{deleteRecord.target_id}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-6 bg-slate-50/50 flex justify-end gap-3 rounded-b-xl border-t border-slate-100">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeleteRecord(null)}
                            disabled={isDeleting}
                            className="text-xs border-slate-200"
                        >
                            {t('Cancel', 'Kanselahin')}
                        </Button>
                        <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={handleHardDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-xs shadow-sm flex items-center gap-1.5"
                        >
                            {isDeleting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                            )}
                            {t('Erase Permanently', 'Permanenteng Burahin')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
