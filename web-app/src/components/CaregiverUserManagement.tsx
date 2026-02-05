import React, { useState, useEffect } from 'react';
import { CaregiverManagement } from './CaregiverManagement';
import { Patient, VitalSign } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Users, AlertCircle } from 'lucide-react';

interface CaregiverUserManagementProps {
    patients: Patient[];
    user: any; // Or specific user type
}

export const CaregiverUserManagement: React.FC<CaregiverUserManagementProps> = ({ patients, user }) => {
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');

    // Default to the first patient if available and none selected
    useEffect(() => {
        if (patients.length > 0 && !selectedPatientId) {
            setSelectedPatientId(patients[0].id);
        }
    }, [patients]);

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">User Management</h2>
                    <p className="text-slate-500">Manage care teams, invitations, and permissions.</p>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                Care Team
                            </CardTitle>
                            <CardDescription>
                                Select a patient to manage their dedicated care team.
                            </CardDescription>
                        </div>

                        <div className="w-full sm:w-[250px]">
                            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                                <SelectTrigger className="bg-white border-slate-300">
                                    <SelectValue placeholder="Select Patient" />
                                </SelectTrigger>
                                <SelectContent>
                                    {patients.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                    {patients.length === 0 && (
                                        <div className="p-2 text-sm text-center text-slate-500">No patients found</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    {selectedPatient ? (
                        <CaregiverManagement
                            patientId={selectedPatient.id}
                            patientName={selectedPatient.name}
                            currentUserAccessLevel={selectedPatient.accessLevel || 'View'}
                        />
                    ) : (
                        <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3">
                            <div className="p-3 bg-slate-100 rounded-full">
                                <AlertCircle className="w-6 h-6 text-slate-400" />
                            </div>
                            <p>No patient selected. Please assign a patient to begin managing the care team.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
