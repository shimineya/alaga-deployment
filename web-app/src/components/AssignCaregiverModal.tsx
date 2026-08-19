import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { UserPlus, Loader2, Mail, Search } from 'lucide-react';

interface AssignCaregiverModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: number;
    patientName: string;
    onSuccess: () => void;
}

export const AssignCaregiverModal: React.FC<AssignCaregiverModalProps> = ({
    isOpen,
    onClose,
    patientId,
    patientName,
    onSuccess
}) => {
    const { token } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [relationship, setRelationship] = useState('Assigned Caregiver');
    const [loading, setLoading] = useState(false);

    // Mock Search State
    const [searchResults, setSearchResults] = useState<{ id: number, name: string, email: string }[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

 const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    setSearchResults([]);
    try {
        const response = await fetch(`${API_URL}/api/caregiver/search?query=${encodeURIComponent(searchQuery)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
            const mapped = data.data.map((u: any) => ({
                id: u.user_id,
                name: `${u.first_name} ${u.last_name}`.trim() || u.username,
                email: u.email
            }));
            setSearchResults(mapped);
        } else {
            setSearchResults([]);
        }
    } catch (error) {
        console.error("Search error:", error);
        toast.error("Failed to search users");
    } finally {
        setHasSearched(true);
        setLoading(false);
    }
};

const handleAssign = async (caregiverId: number | null, email: string | null = null) => {
    if (!caregiverId && email) {
        toast.info("Email invitation feature coming soon.");
        return;
    }
    if (!caregiverId) return;

    setLoading(true);
    try {
        const response = await fetch(`${API_URL}/api/caregiver/patients/${patientId}/assign-caregiver`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                caregiverId,
                relationship
            })
        });

        const data = await response.json();

        if (data.success) {
            toast.success("Caregiver assigned successfully.");
            onSuccess();
        } else {
            toast.error(data.message || "Failed to assign caregiver");
        }
    } catch (error) {
        console.error("Assignment error:", error);
        toast.error("Network error: Failed to assign");
    } finally {
        setLoading(false);
    }
};

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-800">
                        <UserPlus className="w-5 h-5 text-teal-600" />
                        Assign Caregiver
                    </DialogTitle>
                    <DialogDescription>
                        Add a team member for <strong>{patientName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Role / Relationship</Label>
                        <Select value={relationship} onValueChange={setRelationship}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Assigned Caregiver">Primary Caregiver (Assigned)</SelectItem>
                                <SelectItem value="Secondary Caregiver">Secondary Caregiver</SelectItem>
                                <SelectItem value="Nurse">Nurse / Medical Staff</SelectItem>
                                <SelectItem value="Family Member">Family Member</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Search User</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Email or Name"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setHasSearched(false); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Button variant="secondary" onClick={handleSearch} disabled={loading}>
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* RESULTS AREA */}
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                        </div>
                    ) : hasSearched && searchResults.length > 0 ? (
                        <div className="border rounded-md divide-y">
                            {searchResults.map(user => (
                                <div key={user.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{user.name}</p>
                                        <p className="text-xs text-slate-500">{user.email}</p>
                                    </div>
                                    <Button size="sm" onClick={() => handleAssign(user.id)} className="bg-teal-600 text-white h-7 text-xs">
                                        Select
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : hasSearched && searchResults.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-md text-center">
                            <p className="text-sm text-amber-800 font-medium mb-1">User not found</p>
                            <p className="text-xs text-amber-600 mb-3">
                                No registered user found matching "{searchQuery}".
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
                                onClick={() => handleAssign(null, searchQuery)}
                            >
                                <Mail className="w-3.5 h-3.5 mr-2" /> Send Invite to Email
                            </Button>
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};