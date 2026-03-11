import React from 'react';

const FacilityTopologyBuilder: React.FC = () => {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl px-8 py-6 shadow-md text-center max-w-md">
                <h1 className="text-xl font-medium mb-2">Facility Topology Builder</h1>
                <p className="text-sm text-muted-foreground">UI Under Construction</p>
            </div>
        </div>
    );
};

export default FacilityTopologyBuilder;

import React from 'react';

export default function FacilityTopologyBuilder() {
    return (
        <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-800">Facility Topology Builder</h1>
            <p className="text-sm text-slate-500">UI Under Construction.</p>
        </div>
    );
}

