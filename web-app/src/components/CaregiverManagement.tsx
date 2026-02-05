import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CaregiverList } from './CaregiverList';
import { CaregiverActivityLog } from './CaregiverActivityLog';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';

interface CaregiverManagementProps {
    patientId: string;
    patientName: string;
    currentUserAccessLevel: string; // 'View' | 'Edit' | 'Admin'
}

/*
  [User Management]
  This component acts as the orchestrator for the "Care Team" tab.
  It fetches the latest team list and passes it to the list view.
*/

export const CaregiverManagement: React.FC<CaregiverManagementProps> = ({
    patientId,
    patientName,
    currentUserAccessLevel
}) => {
    const { token } = useAuth();
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCaregivers = async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/assignments/caregiver/team/${patientId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setCaregivers(data.data);
            } else {
                // If unauthorized or error, show silent error or empty list
                console.error(data.message);
            }
        } catch (err) {
            console.error("Failed to fetch care team", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCaregivers();
    }, [patientId, token]);

    return (
        <div className="space-y-6">
            <Tabs defaultValue="team" className="w-full">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="team" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Care Team Members</TabsTrigger>
                    <TabsTrigger value="activity" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Activity Log</TabsTrigger>
                </TabsList>

                <TabsContent value="team" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CaregiverList
                        patientId={patientId}
                        patientName={patientName}
                        caregivers={caregivers}
                        onRefresh={fetchCaregivers}
                        currentUserAccessLevel={currentUserAccessLevel}
                    />
                </TabsContent>

                <TabsContent value="activity" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CaregiverActivityLog
                        patientId={patientId}
                        currentUserAccessLevel={currentUserAccessLevel}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};
