import React from 'react';
import { Patient } from '../../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { User } from 'lucide-react';

export const ALL_PATIENTS_ID = '__all__';

interface ReportPatientPickerProps {
  patients: Patient[];
  value: string;
  onValueChange: (patientId: string) => void;
  placeholder?: string;
  showAllOption?: boolean;
}

export const ReportPatientPicker: React.FC<ReportPatientPickerProps> = ({
  patients,
  value,
  onValueChange,
  placeholder = 'Select patient',
  showAllOption = false,
}) => {
  const activePatients = patients.filter((p) => !p.deleted && !p.archived);
  const selectValue = value || (showAllOption ? ALL_PATIENTS_ID : undefined);

  return (
    <div className="flex items-center gap-2">
      <User className="w-3.5 h-3.5 text-slate-400" />
      <Select value={selectValue} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 w-[200px] text-xs border-slate-200" size="sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value={ALL_PATIENTS_ID} className="text-xs">
              All patients
            </SelectItem>
          )}
          {activePatients.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
