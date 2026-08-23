import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { Patient } from '../types';
import {
    Users,
    UserPlus,
    Search,
    ShieldAlert,
    RefreshCw,
    Stethoscope,
    Mail
} from 'lucide-react';
import { CaregiverManagement } from './CaregiverManagement';
import { AssignCaregiverModal } from './AssignCaregiverModal';

// --- TYPES ---
export interface CaregiverProfile {
    user_id: number;
    name: string;
    email: string;
    role: 'Medical Staff' | 'Family Member' | 'Guardian';
    status: 'Active' | 'Pending' | 'On-Leave';
    permissions: {
        can_view_vitals: boolean;
        can_receive_alerts: boolean;
        can_manage_patients: boolean;
        is_admin: boolean;
    };
    last_active?: string;
}

interface CaregiverUserManagementProps {
    patients?: Patient[];
    user?: any;
}

export const CaregiverUserManagement: React.FC<CaregiverUserManagementProps> = ({ patients = [], user }) => {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverProfile | null>(null);
    const [caregivers, setCaregivers] = useState<CaregiverProfile[]>([]);
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    // --- FETCH DATA FROM BACKEND ---
    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/caregivers/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                setCaregivers(data.data);
                if (!selectedCaregiver && data.data.length > 0) {
                    setSelectedCaregiver(data.data[0]);
                }
            } else {
                setCaregivers([]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load caregiver list");
        } finally {
            setIsLoading(false);
        }
    }, [token, selectedCaregiver]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filter Logic
    const filteredList = caregivers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 pb-4 pt-2 space-y-4">
            {/* COMPACT HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500 rounded-lg shadow-sm">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">Caregiver Directory</h2>
                        <p className="text-xs text-slate-500">Manage caregiver access and permissions</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading} className="h-8 text-slate-500">
                        <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs shadow-sm"
                        size="sm"
                        onClick={() => setIsInviteOpen(true)}
                    >
                        <UserPlus className="w-3.5 h-3.5 mr-2" />
                        Invite Caregiver/Medical Staff
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[78vh]">
                {/* LEFT PANEL: CAREGIVER LIST (4 Cols) */}
                <Card className="lg:col-span-4 border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b py-3 px-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                placeholder="Search by name or email..."
                                className="h-9 pl-9 text-xs bg-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-full">
                            <div className="divide-y divide-slate-100">
                                {filteredList.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">No caregivers found.</p>
                                    </div>
                                ) : (
                                    filteredList.map((person) => (
                                        <div
                                            key={person.user_id}
                                            onClick={() => setSelectedCaregiver(person)}
                                            className={`p-3 cursor-pointer transition-colors hover:bg-slate-50 border-l-4 ${selectedCaregiver?.user_id === person.user_id
                                                ? 'bg-indigo-50/60 border-indigo-500'
                                                : 'border-transparent'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className={`text-sm font-semibold ${selectedCaregiver?.user_id === person.user_id ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                    {person.name}
                                                </h3>
                                                <Badge variant="outline" className={`text-[10px] h-5 ${person.status === 'Active' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                                    person.status === 'Pending' ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                                        'text-slate-500 bg-slate-100'
                                                    }`}>
                                                    {person.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                                                <Mail className="w-3 h-3" />
                                                <span className="truncate max-w-[180px]">{person.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600 border border-slate-200">
                                                    {person.role}
                                                </div>
                                                {person.permissions?.is_admin && (
                                                    <div className="px-1.5 py-0.5 rounded bg-purple-100 text-[10px] font-medium text-purple-700 border border-purple-200 flex items-center gap-1">
                                                        <ShieldAlert className="w-2.5 h-2.5" /> Admin
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* RIGHT PANEL: MANAGEMENT & LOGS (8 Cols) */}
                <div className="lg:col-span-8 h-full">
                    {selectedCaregiver ? (
                        <CaregiverManagement
                            caregiver={selectedCaregiver}
                            onUpdate={() => {
                                fetchData();
                                toast.success("Caregiver updated");
                            }}
                        />
                    ) : (
                        <Card className="h-full flex flex-col items-center justify-center text-slate-400 border-dashed border-2">
                            <Stethoscope className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a caregiver to view details</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* MODAL */}
            <AssignCaregiverModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                patientId={0} 
                patientName="Facility Staff"
                onSuccess={() => {
                    setIsInviteOpen(false);
                    fetchData();
                }}
            />
        </div>
    );
};