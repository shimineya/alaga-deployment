import React, { useState } from 'react';
import { Patient, VitalSign } from '../types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Search, Activity, Thermometer, Heart, Eye, UserPlus } from "lucide-react";
// [NEW] Import the Modal
import { AddNewPatientModal } from './AddNewPatient';

interface PatientListProps {
    patients: Patient[];
    onSelectPatient: (patient: Patient) => void;
    vitalSigns: VitalSign[];
    onRefresh?: () => void; // [NEW] Callback for data refresh
}

export const PatientList: React.FC<PatientListProps> = ({ patients, onSelectPatient, vitalSigns, onRefresh }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'active'>('all');

    // [NEW] Modal State
    const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);

    // Filter Logic
    const filteredPatients = patients.filter(patient => {
        const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            patient.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase());
        const isActive = patient.deviceConnected || patient.status === 'Critical' || patient.status === 'Warning';
        const matchesTab = activeTab === 'all' ? true : isActive;
        return matchesSearch && matchesTab && !patient.deleted && !patient.archived;
    });

    const getLatestVital = (patientId: string) => {
        const patientVitals = vitalSigns.filter(v => v.patientId === patientId);
        return patientVitals.length > 0 ? patientVitals[patientVitals.length - 1] : null;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Patient List</h2>
                    <p className="text-slate-500">Manage and monitor all assigned patients</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search name or room..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    {/* [NEW] Quick Add Button */}
                    <Button
                        onClick={() => setIsAddPatientOpen(true)}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Patient
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="all" onValueChange={(val) => setActiveTab(val as 'all' | 'active')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="all">All Patients</TabsTrigger>
                    <TabsTrigger value="active">Active Monitoring</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                    <PatientTable patients={filteredPatients} getLatestVital={getLatestVital} onSelectPatient={onSelectPatient} />
                </TabsContent>
                <TabsContent value="active" className="mt-4">
                    <PatientTable patients={filteredPatients} getLatestVital={getLatestVital} onSelectPatient={onSelectPatient} />
                </TabsContent>
            </Tabs>

            {/* [NEW] Modal Component */}
            <AddNewPatientModal
                isOpen={isAddPatientOpen}
                onOpenChange={setIsAddPatientOpen}
                onSuccess={() => {
                    setIsAddPatientOpen(false);
                    if (onRefresh) onRefresh(); // Trigger data reload in parent
                }}
            />
        </div>
    );
};

interface PatientTableProps {
    patients: Patient[];
    getLatestVital: (id: string) => VitalSign | null;
    onSelectPatient: (patient: Patient) => void;
}

const PatientTable: React.FC<PatientTableProps> = ({ patients, getLatestVital, onSelectPatient }) => {
    if (patients.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <p className="text-slate-500">No patients found matching your criteria.</p>
            </div>
        );
    }

    return (
        <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[250px]">Patient Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Heart Rate</TableHead>
                            <TableHead className="text-center">Temp</TableHead>
                            <TableHead className="text-center">SpO₂</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {patients.map((patient) => {
                            const vital = getLatestVital(patient.id);
                            const isOffline = !patient.deviceConnected;

                            let statusColor = "bg-slate-100 text-slate-800";
                            let statusText = "Stable";

                            if (isOffline) {
                                statusColor = "bg-slate-100 text-slate-500";
                                statusText = "Offline";
                            } else if (patient.status === 'Critical') {
                                statusColor = "bg-red-100 text-red-700 border-red-200";
                                statusText = "Critical";
                            } else if (patient.status === 'Warning') {
                                statusColor = "bg-amber-100 text-amber-700 border-amber-200";
                                statusText = "Warning";
                            } else {
                                statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
                                statusText = "Stable";
                            }

                            return (
                                <TableRow key={patient.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => onSelectPatient(patient)}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span className="text-slate-900">{patient.name}</span>
                                            <span className="text-xs text-slate-500">ID: {patient.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>Room {patient.roomNumber || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${statusColor} border`}>
                                            {statusText}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {vital && !isOffline ? (
                                            <div className="flex items-center justify-center gap-1 font-medium text-slate-700">
                                                <Heart className="w-3 h-3 text-rose-500" />
                                                {Math.round(vital.heartRate)}
                                            </div>
                                        ) : <span className="text-slate-400">--</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {vital && !isOffline ? (
                                            <div className="flex items-center justify-center gap-1 font-medium text-slate-700">
                                                <Thermometer className="w-3 h-3 text-amber-500" />
                                                {vital.temperature.toFixed(1)}°
                                            </div>
                                        ) : <span className="text-slate-400">--</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {vital && !isOffline ? (
                                            <div className="flex items-center justify-center gap-1 font-medium text-slate-700">
                                                <Activity className="w-3 h-3 text-blue-500" />
                                                {Math.round(vital.spo2)}%
                                            </div>
                                        ) : <span className="text-slate-400">--</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onSelectPatient(patient); }}>
                                            <Eye className="w-4 h-4 text-slate-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};