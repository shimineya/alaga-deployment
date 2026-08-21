import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { useCaregiverLanguage } from '../lib/caregiver-language-context';
import { 
    Link as LinkIcon, 
    UserCheck, 
    UserX, 
    Clock, 
    Search, 
    RefreshCw, 
    Trash2, 
    ActivitySquare, 
    Inbox 
} from 'lucide-react';

interface Invite {
    access_id: number;
    patient_id: number;
    patient_name: string;
    relationship: string;
    access_level: string;
    invited_at: string;
    invited_by_first_name?: string;
    invited_by_last_name?: string;
}

interface Patient {
    patient_id: number;
    name: string;
    device_serial_number: string | null;
    relationship?: string;
    access_level?: string;
}

export default function AssignmentCommandCenter() {
    const { token } = useAuth();
    const { t } = useCaregiverLanguage();
    const [isLoading, setIsLoading] = useState(false);
    
    // States
    const [invites, setInvites] = useState<Invite[]>([]);
    const [activePatients, setActivePatients] = useState<Patient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const API_BASE = import.meta.env.VITE_API_URL || '';

    // Fetch Invites & Active Patients
    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. Pending invites
            const inviteRes = await fetch(`${API_BASE}/api/assignments/pending-invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const inviteData = await inviteRes.json();
            if (inviteData.success) {
                setInvites(inviteData.data || []);
            }

            // 2. Active assignments
            const patientRes = await fetch(`${API_BASE}/api/assignments/my-assignments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const patientData = await patientRes.json();
            if (patientData.success) {
                setActivePatients(patientData.data || []);
            }
        } catch (err) {
            console.error(err);
            toast.error(t('Failed to load assignments', 'Hindi maikarga ang mga assignment'));
        } finally {
            setIsLoading(false);
        }
    }, [token, t, API_BASE]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle Respond to Invite
    const handleRespond = async (accessId: number, action: 'accept' | 'decline') => {
        try {
            const res = await fetch(`${API_BASE}/api/assignments/respond-invite`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ access_id: accessId, action })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error(t('Failed to respond to invitation', 'Hindi masagot ang imbitasyon'));
        }
    };

    // Handle Self Remove (Resign)
    const handleSelfRemove = async (patientId: number, patientName: string) => {
        if (!confirm(t(`Are you sure you want to resign from caring for ${patientName}?`, `Sigurado ka bang nais mong mag-resign sa pag-aalaga kay ${patientName}?`))) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/assignments/caregiver/self-remove`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ patient_id: patientId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error(t('Failed to resign from assignment', 'Hindi maka-resign sa assignment'));
        }
    };

    // Filter logic for active patients
    const filteredPatients = activePatients.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Search suggestion generator (autocomplete)
    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (val.trim().length > 0) {
            // Filter match suggestions from within database patients caregiver is linked to
            const matches = activePatients
                .map(p => p.name)
                .filter(name => name.toLowerCase().includes(val.toLowerCase()));
            setSuggestions(Array.from(new Set(matches)));
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (val: string) => {
        setSearchQuery(val);
        setShowSuggestions(false);
    };

    return (
        <div className="w-full h-full space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <ActivitySquare className="w-6 h-6 text-teal-600 animate-pulse" />
                        {t('Assignment Command Center', 'Assignment Command Center')}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {t('Review and manage patient care relationships assigned to you.', 'Suriin at pamahalaan ang mga relasyon sa pag-aalaga ng pasyente na nakatalaga sa iyo.')}
                    </p>
                </div>
                <Button size="sm" variant="outline" onClick={fetchData} disabled={isLoading} className="h-9 gap-1.5">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('Refresh Feed', 'I-refresh ang Feed')}
                </Button>
            </div>

            {/* Pending Invitations Section */}
            <Card className="border-amber-100 bg-amber-50/20 shadow-sm shrink-0">
                <CardHeader className="py-3 px-4 border-b border-amber-50">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                        <Inbox className="w-4 h-4" />
                        {t('Pending Invitations', 'Mga Nakabinbing Imbitasyon')} ({invites.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {invites.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">
                            {t('No pending invitations at this time.', 'Walang nakabinbing imbitasyon sa ngayon.')}
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {invites.map((invite) => (
                                <div key={invite.access_id} className="p-3 border border-amber-100 bg-white rounded-xl shadow-xs flex justify-between items-center gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-sm text-slate-800">{invite.patient_name}</h3>
                                            <Badge className="bg-amber-100 text-amber-800 text-[9px] hover:bg-amber-100 border-none font-normal h-4 py-0">
                                                {t('Pending', 'Nakabinbin')}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {t('Role', 'Tungkulin')}: <span className="font-semibold text-slate-600">{invite.relationship}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {t('Invited by', 'Inimbitahan ni')}: {invite.invited_by_first_name || ''} {invite.invited_by_last_name || t('System', 'System')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button 
                                            size="sm" 
                                            onClick={() => handleRespond(invite.access_id, 'accept')}
                                            className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs font-semibold px-3"
                                        >
                                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                                            {t('Accept', 'Tanggapin')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => handleRespond(invite.access_id, 'decline')}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs border-red-200"
                                        >
                                            <UserX className="w-3.5 h-3.5 mr-1" />
                                            {t('Decline', 'Tanggihan')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Active Care Assignments Section */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div>
                        <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-teal-600" />
                            {t('Active Assignments', 'Mga Aktibong Assignment')}
                        </CardTitle>
                        <CardDescription>
                            {t('Patients currently registered under your caregiver roster.', 'Mga pasyenteng kasalukuyang nakarehistro sa iyong caregiver roster.')}
                        </CardDescription>
                    </div>

                    {/* Search suggestion box */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder={t('Search patients...', 'Maghanap ng pasyente...')}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="pl-9 h-9 text-xs focus-visible:ring-teal-500 bg-slate-50 border-slate-200 rounded-lg"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {suggestions.map((sug) => (
                                    <button
                                        key={sug}
                                        onClick={() => handleSuggestionClick(sug)}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors"
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-6 flex-1 overflow-y-auto min-h-0">
                    {filteredPatients.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">
                                {searchQuery.trim().length > 0 
                                    ? t('No patients found matching your search.', 'Walang nahanap na pasyente na tumutugma sa iyong paghahanap.')
                                    : t('No active assignments. Accept pending invites to populate your dashboard.', 'Walang aktibong assignment. Tanggapin ang mga imbitasyon para mapuno ang iyong dashboard.')
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {filteredPatients.map((patient) => (
                                <div key={patient.patient_id} className="p-4 border border-slate-200/80 rounded-xl hover:shadow-md transition-shadow flex flex-col justify-between h-40 bg-white relative">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-base text-slate-800 tracking-tight truncate pr-6">{patient.name}</h3>
                                            <Badge className="bg-teal-50 text-teal-700 text-[10px] hover:bg-teal-100 border-none font-normal h-4 py-0">
                                                {patient.relationship || t('Caregiver', 'Caregiver')}
                                            </Badge>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500">
                                                {t('Patient ID', 'ID ng Pasyente')}: <span className="font-mono text-slate-700">{patient.patient_id}</span>
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {t('Device MAC', 'MAC ng Device')}: <span className="font-mono text-slate-700">{patient.device_serial_number || t('None', 'Wala')}</span>
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                                        <span className="text-[10px] text-slate-400">
                                            {t('Access Level', 'Antas ng Akses')}: {patient.access_level || 'View'}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSelfRemove(patient.patient_id, patient.name)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs px-2"
                                            title={t('Resign from patient care', 'Mag-resign sa pag-aalaga')}
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            {t('Resign', 'Resign')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
