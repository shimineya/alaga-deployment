import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { useCaregiverLanguage } from '../lib/caregiver-language-context';
import { 
    Users, 
    UserPlus, 
    Trash2, 
    Clock, 
    CheckCircle, 
    XCircle, 
    Search,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { AssignCaregiverModal } from './AssignCaregiverModal';

interface Patient {
    patient_id: number;
    name: string;
    device_serial_number: string | null;
}

interface CareTeamMember {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    system_role: string;
    relationship: string;
    access_level: string;
    invite_status: string; // 'Pending' | 'Active' | 'Declined'
}

export default function ParentCareTeamManagement() {
    const { token, user } = useAuth();
    const { t } = useCaregiverLanguage();
    
    // States
    const [patients, setPatients] = useState<Patient[]>([]);
    const [careTeams, setCareTeams] = useState<Record<number, CareTeamMember[]>>({});
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [selectedPatientName, setSelectedPatientName] = useState('');

    const API_BASE = import.meta.env.VITE_API_URL || '';

    // Fetch patients, care teams, and pending invitations
    const fetchAllData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // 1. Fetch parent's own pending invitations
            const inviteRes = await fetch(`${API_BASE}/api/assignments/pending-invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const inviteData = await inviteRes.json();
            if (inviteData.success) {
                setPendingInvites(inviteData.data || []);
            }

            // 2. Fetch parent's children
            const patRes = await fetch(`${API_BASE}/api/caregiver/patients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const patData = await patRes.json();
            if (patData.success && Array.isArray(patData.data)) {
                const fetchedPatients: Patient[] = patData.data;
                setPatients(fetchedPatients);

                // 3. Fetch care team for each patient
                const teamsMap: Record<number, CareTeamMember[]> = {};
                await Promise.all(
                    fetchedPatients.map(async (pat) => {
                        const teamRes = await fetch(`${API_BASE}/api/caregiver/patients/${pat.patient_id}/care-team`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const teamData = await teamRes.json();
                        if (teamData.success) {
                            teamsMap[pat.patient_id] = teamData.data || [];
                        }
                    })
                );
                setCareTeams(teamsMap);
            }
        } catch (err) {
            console.error(err);
            toast.error(t('Failed to load care team data', 'Hindi maikarga ang data ng pangkat ng pangangalaga'));
        } finally {
            setLoading(false);
        }
    }, [token, t, API_BASE]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Accept / Decline Invitation
    const handleRespondInvite = async (accessId: number, action: 'accept' | 'decline') => {
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
                toast.success(action === 'accept' ? 'Invitation accepted!' : 'Invitation declined.');
                fetchAllData();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to respond to invitation.');
        }
    };

    // Remove caregiver
    const handleRemoveCaregiver = async (patientId: number, caregiverId: number, caregiverName: string) => {
        if (!confirm(t(`Are you sure you want to remove ${caregiverName} from this patient's care team?`, `Sigurado ka bang nais mong alisin si ${caregiverName} sa pangkat ng pangangalaga ng pasyenteng ito?`))) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/caregiver/patients/${patientId}/care-team/${caregiverId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t('Caregiver removed successfully.', 'Matagumpay na naalis ang caregiver.'));
                fetchAllData();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error(t('Failed to remove caregiver.', 'Hindi maalis ang caregiver.'));
        }
    };

    const openInviteModal = (patientId: number, patientName: string) => {
        setSelectedPatientId(patientId);
        setSelectedPatientName(patientName);
        setIsAssignOpen(true);
    };

    // Filter patients
    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full h-full space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-teal-600" />
                        {t('Care Team Management', 'Pamamahala ng Care Team')}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {t('Manage caregivers and monitor their invitation status in real-time.', 'Pamahalaan ang mga caregiver at subaybayan ang katayuan ng kanilang imbitasyon sa real-time.')}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button 
                        size="sm" 
                        onClick={() => openInviteModal(-1, '')}
                        className="bg-teal-600 hover:bg-teal-700 text-white h-9 px-4 font-semibold shrink-0 gap-1.5"
                    >
                        <UserPlus className="w-4 h-4" />
                        {t('Invite Member', 'Mag-imbita ng Miyembro')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={fetchAllData} disabled={loading} className="h-9 gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {t('Refresh Care Teams', 'I-refresh ang mga Care Team')}
                    </Button>
                </div>
            </div>

            {/* Pending Invitations Section */}
            <Card className="border-amber-200 bg-amber-50/20 shadow-xs shrink-0 animate-in fade-in duration-200">
                <CardHeader className="py-3 px-6 border-b border-amber-100 flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                            {t('Pending Care Team Invitations', 'Mga Nakabinbing Imbitasyon sa Care Team')} ({pendingInvites.length})
                        </CardTitle>
                        <CardDescription className="text-[10px] mt-0.5">
                            {t('You have been invited to join the care team of these patients.', 'Inimbitahan kang sumali sa pangkat ng pangangalaga ng mga pasyenteng ito.')}
                        </CardDescription>
                    </div>
                    {pendingInvites.length > 0 && (
                        <Badge variant="outline" className="bg-amber-100/50 text-amber-800 border-amber-200 font-semibold text-[10px]">
                            {pendingInvites.length} {t('New', 'Bago')}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    {pendingInvites.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2 text-center">
                            {t('No pending invitations at this time.', 'Walang nakabinbing imbitasyon sa ngayon.')}
                        </p>
                    ) : (
                        pendingInvites.map((invite) => (
                            <div key={invite.access_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-slate-100 rounded-lg gap-4 hover:shadow-xs transition-shadow">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-xs">{invite.patient_name}</h4>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 mt-0.5">
                                        <span>
                                            {t('Relationship', 'Relasyon')}: <span className="font-medium text-slate-700">{invite.relationship}</span>
                                        </span>
                                        <span className="hidden sm:inline text-slate-300">•</span>
                                        {invite.invited_by_first_name && (
                                            <span>
                                                {t('Invited by', 'Inimbita ni')}: <span className="font-medium text-slate-700">{invite.invited_by_first_name} {invite.invited_by_last_name}</span>
                                            </span>
                                        )}
                                        <span className="hidden sm:inline text-slate-300">•</span>
                                        <span>
                                            {t('Received', 'Natanggap')}: {new Date(invite.invited_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button
                                        size="sm"
                                        onClick={() => handleRespondInvite(invite.access_id, 'accept')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] h-7 px-3"
                                    >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {t('Accept', 'Tanggapin')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRespondInvite(invite.access_id, 'decline')}
                                        className="border-slate-200 hover:bg-red-50 hover:text-red-600 font-semibold text-[10px] h-7 px-3 text-slate-600"
                                    >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        {t('Decline', 'Tanggihan')}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {loading && patients.length === 0 ? (
                <div className="flex justify-center items-center py-20 flex-1">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
            ) : filteredPatients.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-xl bg-white">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">
                        {t('No patients registered under your account.', 'Walang nakarehistrong pasyente sa iyong account.')}
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                    {filteredPatients.map((patient) => {
                        const team = careTeams[patient.patient_id] || [];
                        return (
                            <Card key={patient.patient_id} className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                                <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-base font-bold text-slate-800">{patient.name}</CardTitle>
                                        <CardDescription className="text-xs">
                                            {t('Patient ID', 'ID ng Pasyente')}: <span className="font-mono">{patient.patient_id}</span>
                                        </CardDescription>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        onClick={() => openInviteModal(patient.patient_id, patient.name)}
                                        className="bg-teal-600 hover:bg-teal-700 text-white h-9 px-4 font-semibold shrink-0"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        {t('Invite Member', 'Mag-imbita ng Miyembro')}
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                        {t('Assigned Caregivers', 'Mga Nakatalagang Caregiver')} ({team.length})
                                    </h4>
                                    {team.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic py-2">
                                            {t('No care team members assigned yet. Click "Invite Member" to add one.', 'Walang nakatalagang miyembro sa ngayon. I-click ang "Mag-imbita ng Miyembro" para magdagdag.')}
                                        </p>
                                    ) : (
                                        <div className="border rounded-xl divide-y bg-slate-50/20">
                                            {team.map((member) => {
                                                const isSelf = member.user_id === user?.id;
                                                return (
                                                    <div key={member.user_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                                                {member.first_name[0]}{member.last_name[0]}
                                                            </div>
                                                            <div>
                                                                <h5 className="text-sm font-bold text-slate-800">
                                                                    {member.first_name} {member.last_name}
                                                                    {isSelf && <span className="text-slate-400 font-normal text-xs ml-1">({t('You', 'Ikaw')})</span>}
                                                                </h5>
                                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                                    <span className="text-xs text-slate-500">{member.email}</span>
                                                                    <span className="text-slate-300">•</span>
                                                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-slate-100 text-slate-600 font-normal">
                                                                        {member.relationship}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                                                            {/* Real-time Status Badge */}
                                                            <div>
                                                                {member.invite_status === 'Pending' && (
                                                                    <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50 flex items-center gap-1 text-[10px] font-normal h-6 px-2.5">
                                                                        <Clock className="w-3 h-3" />
                                                                        {t('Pending Acceptance', 'Nakabinbing Pagtanggap')}
                                                                    </Badge>
                                                                )}
                                                                {member.invite_status === 'Declined' && (
                                                                    <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 flex items-center gap-1 text-[10px] font-normal h-6 px-2.5">
                                                                        <XCircle className="w-3 h-3" />
                                                                        {t('Declined invitation', 'Tinanggihan ang imbitasyon')}
                                                                    </Badge>
                                                                )}
                                                                {(member.invite_status === 'Active' || !member.invite_status) && (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 flex items-center gap-1 text-[10px] font-normal h-6 px-2.5">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        {t('Active', 'Aktibo')}
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            {/* Delete caregiver button (cannot delete self) */}
                                                            {!isSelf && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveCaregiver(patient.patient_id, member.user_id, `${member.first_name} ${member.last_name}`)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Invite Caregiver Modal */}
            {selectedPatientId && (
                <AssignCaregiverModal
                    isOpen={isAssignOpen}
                    onClose={() => setIsAssignOpen(false)}
                    patientId={selectedPatientId}
                    patientName={selectedPatientName}
                    onSuccess={() => {
                        setIsAssignOpen(false);
                        fetchAllData();
                    }}
                />
            )}
        </div>
    );
}
