import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Patient } from '../types';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';
import {
  User,
  Users,
  Shield,
  Lock,
  Phone,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface CaregiverProfileProps {
  patients: Patient[];
}

interface CareCircleMember {
  id: string;
  name: string;
  role: string;
  contact: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  type: string;
}

const IDENTITY_KEY = 'alaga_caregiver_profile_identity';
const CARE_CIRCLE_KEY = 'alaga_caregiver_care_circle';
const EMERGENCY_KEY = 'alaga_caregiver_emergency_contacts';
const TWO_FA_KEY = 'alaga_caregiver_two_factor_enabled';

export const CaregiverProfile: React.FC<CaregiverProfileProps> = ({ patients }) => {
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [careCircle, setCareCircle] = useState<CareCircleMember[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteContact, setInviteContact] = useState('');

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [emName, setEmName] = useState('');
  const [emRelation, setEmRelation] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [emType, setEmType] = useState('');

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Load persisted settings
  useEffect(() => {
    try {
      const identityRaw = localStorage.getItem(IDENTITY_KEY);
      if (identityRaw) {
        const id = JSON.parse(identityRaw) as { fullName?: string; phone?: string; photoUrl?: string };
        if (id.fullName) setFullName(id.fullName);
        if (id.phone) setPhone(id.phone);
        if (id.photoUrl) setPhotoUrl(id.photoUrl);
      } else if (user) {
        setFullName(user.username || user.email || '');
      }
    } catch {
      // ignore parse errors
    }

    try {
      const circleRaw = localStorage.getItem(CARE_CIRCLE_KEY);
      if (circleRaw) {
        setCareCircle(JSON.parse(circleRaw));
      }
    } catch {
      // ignore parse errors
    }

    try {
      const emRaw = localStorage.getItem(EMERGENCY_KEY);
      if (emRaw) {
        setEmergencyContacts(JSON.parse(emRaw));
      }
    } catch {
      // ignore parse errors
    }

    try {
      const twoFaRaw = localStorage.getItem(TWO_FA_KEY);
      if (twoFaRaw) {
        setTwoFactorEnabled(twoFaRaw === 'true');
      }
    } catch {
      // ignore parse errors
    }
  }, [user]);

  const avatarInitials = useMemo(() => {
    const base = fullName || user?.username || user?.email || 'C';
    return base
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [fullName, user]);

  const handleSaveIdentity = () => {
    try {
      localStorage.setItem(
        IDENTITY_KEY,
        JSON.stringify({ fullName, phone, photoUrl })
      );
      toast.success('Profile updated');
    } catch {
      toast.error('Could not save profile locally');
    }
  };

  const persistCareCircle = (items: CareCircleMember[]) => {
    setCareCircle(items);
    try {
      localStorage.setItem(CARE_CIRCLE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const handleInvite = () => {
    if (!inviteName || !inviteContact) {
      toast.error('Name and contact are required');
      return;
    }
    const next: CareCircleMember[] = [
      ...careCircle,
      {
        id: crypto.randomUUID(),
        name: inviteName,
        role: inviteRole || 'Family',
        contact: inviteContact,
      },
    ];
    persistCareCircle(next);
    setInviteName('');
    setInviteRole('');
    setInviteContact('');
    toast.success('Invite recorded (mock). Share access through your preferred channel.');
  };

  const handleRemoveMember = (id: string) => {
    const next = careCircle.filter(m => m.id !== id);
    persistCareCircle(next);
  };

  const persistEmergencyContacts = (items: EmergencyContact[]) => {
    setEmergencyContacts(items);
    try {
      localStorage.setItem(EMERGENCY_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const handleAddEmergency = () => {
    if (!emName || !emPhone) {
      toast.error('Name and phone are required');
      return;
    }
    const next: EmergencyContact[] = [
      ...emergencyContacts,
      {
        id: crypto.randomUUID(),
        name: emName,
        relation: emRelation || 'Family',
        phone: emPhone,
        type: emType || 'Doctor',
      },
    ];
    persistEmergencyContacts(next);
    setEmName('');
    setEmRelation('');
    setEmPhone('');
    setEmType('');
    toast.success('Emergency contact saved to Speed Dial list');
  };

  const handleRemoveEmergency = (id: string) => {
    const next = emergencyContacts.filter(c => c.id !== id);
    persistEmergencyContacts(next);
  };

  const handleToggleTwoFactor = (checked: boolean) => {
    setTwoFactorEnabled(checked);
    try {
      localStorage.setItem(TWO_FA_KEY, checked ? 'true' : 'false');
    } catch {
      // ignore
    }
    toast.success(checked ? 'Two-factor authentication enabled (UI only)' : 'Two-factor authentication disabled');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Caregiver Profile</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Keep your identity, care circle, and emergency contacts up to date so everyone sees the same data during critical moments.
        </p>
      </div>

      {/* 1. Caregiver Identity */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-teal-600" />
            Caregiver identity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold overflow-hidden">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                avatarInitials
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <Label className="text-[11px] text-slate-600">Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-slate-600">Contact number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+63 9XX XXX XXXX"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Profile photo URL (optional)</Label>
                  <Input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" className="h-8 text-xs" onClick={handleSaveIdentity}>
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Patient Profiles */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-sky-600" />
            Patient profile(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          <p className="text-[11px] text-slate-500">
           
          </p>
          {patients.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">
              No patients are linked to your account yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {patients.map((patient) => {
                const primaryCondition =
                  (patient.medicalConditions && patient.medicalConditions[0]) || 'Not specified';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rawAllergies = (patient as any).allergies as string[] | undefined;
                const allergiesText = rawAllergies && rawAllergies.length > 0
                  ? rawAllergies.join(', ')
                  : 'None recorded';

                return (
                  <div
                    key={patient.id}
                    className="border border-slate-100 rounded-md p-2.5 bg-slate-50/60 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {patient.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Age {patient.age || '—'}
                        </p>
                      </div>
                      {patient.assignedCaregiverName && (
                        <span className="text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full font-medium">
                          Assigned: {patient.assignedCaregiverName}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600">
                      <span className="font-medium">Primary condition:</span>{' '}
                      {primaryCondition}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      <span className="font-medium">Known allergies:</span>{' '}
                      {allergiesText}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Care Circle (User Management) */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Care circle (shared access)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <p className="text-[11px] text-slate-500">
            Invite trusted family members or nurses so they can see the same real-time data and alerts on their own devices.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px] text-slate-600">Name</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Lola's daughter"
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Role / relation</Label>
              <Input
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                placeholder="Family / Nurse"
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Contact (email or phone)</Label>
              <Input
                value={inviteContact}
                onChange={(e) => setInviteContact(e.target.value)}
                placeholder="example@email.com"
                className="h-8 text-xs mt-0.5"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs flex items-center gap-1.5"
              onClick={handleInvite}
            >
              <Plus className="w-3 h-3" />
              Save invite
            </Button>
          </div>
          {careCircle.length > 0 && (
            <div className="border-t border-slate-100 pt-2 mt-1 space-y-1.5">
              {careCircle.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between text-[11px] text-slate-700"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-slate-500">
                      {member.role} • {member.contact}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Security & Privacy (RA 10173 + 2FA) */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-rose-600" />
            Security & privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-700">
              RA 10173 (Data Privacy Act) compliance
            </p>
            <p className="text-[11px] text-slate-500">
              Your data is handled in line with RA 10173 and similar global health privacy standards.
            </p>
            <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
              <li>All data in transit is encrypted over HTTPS (TLS) between your browser and the server.</li>
              <li>Health and personal data are stored in encrypted databases at rest using industry-standard ciphers.</li>
              <li>Only authorized roles (caregiver, medical staff, facility admin) can view patient data they are assigned to.</li>
              <li>Access logs and alerts help detect unusual sign-ins or sharing behavior.</li>
            </ul>
          </div>

          <div className="border-t border-slate-100 pt-2 mt-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <div>
                  <p className="text-[11px] font-medium text-slate-700">
                    Two-factor authentication (2FA)
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Add a second step at login (e.g. SMS or authenticator app) for sensitive health data.
                  </p>
                </div>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={handleToggleTwoFactor}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              This toggle controls the UI preference. Actual 2FA delivery (SMS / authenticator app) depends on backend configuration.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Emergency Contacts / Speed Dial */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Emergency contacts (Speed Dial)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <p className="text-[11px] text-slate-500">
            These contacts will surface as a quick “Speed Dial” list on the home screen during a critical alert, so you can call for help in one tap.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[11px] text-slate-600">Name</Label>
              <Input
                value={emName}
                onChange={(e) => setEmName(e.target.value)}
                placeholder="On-call doctor"
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Relation</Label>
              <Input
                value={emRelation}
                onChange={(e) => setEmRelation(e.target.value)}
                placeholder="Doctor / Ambulance / Family"
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Phone number</Label>
              <Input
                value={emPhone}
                onChange={(e) => setEmPhone(e.target.value)}
                placeholder="+63 2 8XX XXXX"
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Type</Label>
              <Input
                value={emType}
                onChange={(e) => setEmType(e.target.value)}
                placeholder="Doctor / Nurse / Ambulance"
                className="h-8 text-xs mt-0.5"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs flex items-center gap-1.5"
              onClick={handleAddEmergency}
            >
              <Plus className="w-3 h-3" />
              Add to Speed Dial
            </Button>
          </div>

          {emergencyContacts.length > 0 && (
            <div className="border-t border-slate-100 pt-2 mt-1 space-y-1.5">
              {emergencyContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-[11px] text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-amber-50 flex items-center justify-center">
                      <Phone className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {c.name}{' '}
                        <span className="text-[10px] text-slate-500">
                          ({c.relation || c.type})
                        </span>
                      </span>
                      <span className="text-slate-500">{c.phone}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                    onClick={() => handleRemoveEmergency(c.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

