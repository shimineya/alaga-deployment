import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle 
} from '../ui/dialog';
import { 
    Search, 
    RefreshCw, 
    Upload, 
    Edit, 
    Trash2, 
    Wifi, 
    Clock, 
    Cpu,
    Plus
} from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });

interface FirmwareVersion {
    key: string;
    version: string;
    name: string;
    features: string;
    file: string;
    checksum: string;
    uploaded_at: string;
}

export default function FirmwareOTAUpdates() {
    const { token } = useAuth();
    const [updates, setUpdates] = useState<FirmwareVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Search & Suggestion states
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Upload state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadVersion, setUploadVersion] = useState('');
    const [uploadName, setUploadName] = useState('');
    const [uploadFeatures, setUploadFeatures] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Edit state
    const [editUpdate, setEditUpdate] = useState<FirmwareVersion | null>(null);
    const [editVersion, setEditVersion] = useState('');
    const [editName, setEditName] = useState('');
    const [editFeatures, setEditFeatures] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Push states
    const [isPushing, setIsPushing] = useState<string | null>(null);

    const fetchUpdates = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/firmware/versions`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setUpdates(data.data || []);
            }
        } catch {
            toast.error('Failed to load firmware updates list.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchUpdates();
    }, [fetchUpdates]);

    // Handle suggestions based on name/features
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const list: string[] = [];
            updates.forEach(u => {
                if (u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !list.includes(u.name)) {
                    list.push(u.name);
                }
                if (u.version.toLowerCase().includes(searchQuery.toLowerCase()) && !list.includes(u.version)) {
                    list.push(u.version);
                }
            });
            setSuggestions(list.slice(0, 5));
        } else {
            setSuggestions([]);
        }
    }, [searchQuery, updates]);

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) {
            toast.error('Please select a firmware binary file (.bin).');
            return;
        }
        if (!uploadVersion.trim() || !uploadName.trim() || !uploadFeatures.trim()) {
            toast.error('Version label, update name, and description of features are required.');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('firmware_file', uploadFile);
            formData.append('version_label', uploadVersion.trim());
            formData.append('name', uploadName.trim());
            formData.append('features', uploadFeatures.trim());

            const res = await fetch(`${API}/firmware/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Software update uploaded and integrity checksum calculated.');
                setIsUploadOpen(false);
                setUploadFile(null);
                setUploadVersion('');
                setUploadName('');
                setUploadFeatures('');
                fetchUpdates();

                // Automatically trigger WiFi broadcast push immediately after upload
                handleBroadcastPush(data.data?.version || uploadVersion);
            } else {
                toast.error(data.message || 'Firmware upload failed.');
            }
        } catch {
            toast.error('Server error uploading firmware.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUpdate) return;
        if (!editVersion.trim() || !editName.trim() || !editFeatures.trim()) {
            toast.error('All fields are required.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${API}/firmware/${editUpdate.key}`, {
                method: 'PUT',
                headers: {
                    ...getAuth(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    version_label: editVersion.trim(),
                    name: editName.trim(),
                    features: editFeatures.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Software update details updated.');
                setEditUpdate(null);
                fetchUpdates();
            } else {
                toast.error(data.message || 'Failed to update details.');
            }
        } catch {
            toast.error('Server error updating details.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchiveUpdate = async (key: string) => {
        if (!window.confirm('Are you sure you want to archive/remove this software update? Devices will no longer be able to pull this binary version.')) return;
        try {
            const res = await fetch(`${API}/firmware/${key}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Software update archived successfully.');
                fetchUpdates();
            } else {
                toast.error(data.message || 'Failed to archive update.');
            }
        } catch {
            toast.error('Server error archiving update.');
        }
    };

    const handleBroadcastPush = async (versionLabel: string) => {
        setIsPushing(versionLabel);
        try {
            const res = await fetch(`${API}/firmware/push`, {
                method: 'POST',
                headers: {
                    ...getAuth(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ version_label: versionLabel })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Successfully broadcast update "${versionLabel}" immediately to all active Wi-Fi devices!`);
            } else {
                toast.error(data.message || 'Failed to broadcast update.');
            }
        } catch {
            toast.error('Network error during broadcast push.');
        } finally {
            setIsPushing(null);
        }
    };

    const filteredUpdates = updates.filter(u => {
        const query = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(query) ||
               u.version.toLowerCase().includes(query) ||
               u.features.toLowerCase().includes(query);
    });

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header controls block */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Wifi className="w-5 h-5 text-teal-600 animate-pulse" />
                        Firmware OTA Updates Control Center
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                        Configure, verify, and broadcast software updates immediately to all whitelisted smart sensors connected over Wi-Fi.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Search updates by name or features..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                                {suggestions.map(s => (
                                    <button
                                        key={s}
                                        onMouseDown={() => {
                                            setSearchQuery(s);
                                            setShowSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors border-b last:border-b-0"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchUpdates} disabled={isLoading} className="h-8 gap-1 bg-white cursor-pointer shrink-0">
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => setIsUploadOpen(true)} className="h-8 gap-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                        Upload Update
                    </Button>
                </div>
            </div>

            {/* Updates list table */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-[400px]">
                <CardHeader className="py-4 px-4 border-b border-slate-100 shrink-0">
                    <CardTitle className="text-xs font-bold text-slate-800">Firmware Update History</CardTitle>
                    <CardDescription className="text-[9px] text-slate-400">Total binary updates whitelisted: {updates.length}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    {filteredUpdates.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">No software updates whitelisted.</div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 w-[120px]">Version</th>
                                    <th className="p-3 w-[250px]">Update Name</th>
                                    <th className="p-3">Update Features</th>
                                    <th className="p-3 w-[160px]">Upload Date & Time</th>
                                    <th className="p-3 text-right w-[200px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUpdates.map((u) => (
                                    <tr key={u.key} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-3">
                                            <Badge className="border-none font-bold text-[8px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-mono">
                                                v{u.version}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <Cpu className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold text-slate-800">{u.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-slate-600 font-medium">
                                            {u.features}
                                        </td>
                                        <td className="p-3 text-slate-400 font-mono text-[10px] whitespace-nowrap">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-300" />
                                                {new Date(u.uploaded_at).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Push OTA */}
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handleBroadcastPush(u.version)}
                                                    disabled={isPushing !== null}
                                                    className="h-7 text-[9px] gap-1 border-teal-200 text-teal-700 hover:bg-teal-50 cursor-pointer"
                                                >
                                                    <Wifi className={`w-3 h-3 ${isPushing === u.version ? 'animate-ping' : ''}`} />
                                                    {isPushing === u.version ? 'Pushing...' : 'Push Wifi'}
                                                </Button>

                                                {/* Edit */}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => {
                                                        setEditUpdate(u);
                                                        setEditVersion(u.version);
                                                        setEditName(u.name);
                                                        setEditFeatures(u.features);
                                                    }} 
                                                    className="h-7 w-7 text-slate-500 hover:text-slate-700 cursor-pointer"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </Button>

                                                {/* Archive */}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleArchiveUpdate(u.key)} 
                                                    className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
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

            {/* UPLOAD DIALOG */}
            {isUploadOpen && (
                <Dialog open={true} onOpenChange={() => setIsUploadOpen(false)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-teal-600" />
                                Upload Firmware Update
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Upload a new compiled software update binary (.bin) and automatically broadcast it to connected hardware nodes.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleUploadSubmit} className="space-y-4 py-2 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Select Update Binary (.bin)</label>
                                <Input 
                                    type="file"
                                    accept=".bin"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setUploadFile(e.target.files[0]);
                                        }
                                    }}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Update Name</label>
                                <Input 
                                    placeholder="e.g. Smart Diaper Calibration Patch"
                                    value={uploadName} 
                                    onChange={(e) => setUploadName(e.target.value)}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Version Label</label>
                                <Input 
                                    placeholder="e.g. 2.0.4"
                                    value={uploadVersion} 
                                    onChange={(e) => setUploadVersion(e.target.value)}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Update Features / Release Notes</label>
                                <textarea 
                                    placeholder="Describe new calibration standards, bug fixes, or signal enhancements..."
                                    value={uploadFeatures} 
                                    onChange={(e) => setUploadFeatures(e.target.value)}
                                    required
                                    rows={3}
                                    className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-700"
                                />
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadOpen(false)} className="h-8 text-xs">Cancel</Button>
                                <Button type="submit" disabled={isUploading} className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                                    {isUploading ? 'Uploading & Hashing...' : 'Upload & Broadcast'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* EDIT DIALOG */}
            {editUpdate && (
                <Dialog open={true} onOpenChange={() => setEditUpdate(null)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800 flex items-center gap-2">
                                <Edit className="w-5 h-5 text-indigo-600" />
                                Edit Update Metadata
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Adjust release labels or update descriptions for software update v{editUpdate.version}.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditSubmit} className="space-y-4 py-2 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Update Name</label>
                                <Input 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Version Label</label>
                                <Input 
                                    value={editVersion} 
                                    onChange={(e) => setEditVersion(e.target.value)}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Update Features / Release Notes</label>
                                <textarea 
                                    value={editFeatures} 
                                    onChange={(e) => setEditFeatures(e.target.value)}
                                    required
                                    rows={3}
                                    className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-700"
                                />
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setEditUpdate(null)} className="h-8 text-xs">Cancel</Button>
                                <Button type="submit" disabled={isSaving} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
