import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Home, Building2, Activity, ArrowRight } from 'lucide-react';

export const UserTypeSelection: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectType = (type: 'home' | 'clinical') => {
        navigate('/registration', { state: { userType: type } });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F0FAF9' }}>
            <Card className="w-full max-w-2xl border-0" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
                <CardHeader className="text-center pb-8">
                    <div className="flex justify-center mb-4">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{
                                backgroundColor: '#7DD3C0',
                                boxShadow: '0 0 30px rgba(125, 211, 192, 0.4)'
                            }}
                        >
                            <Activity className="w-9 h-9 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl mb-2" style={{ color: '#2C3E50' }}>Welcome to ALAGA</CardTitle>
                    <CardDescription className="text-base">
                        Select your usage type to get started
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pb-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Home Use Option */}
                        <div
                            onClick={() => handleSelectType('home')}
                            className="p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg group relative overflow-hidden"
                            style={{
                                borderColor: '#E8F6F3',
                                backgroundColor: 'white'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#7DD3C0';
                                e.currentTarget.style.backgroundColor = '#F0FAF9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#E8F6F3';
                                e.currentTarget.style.backgroundColor = 'white';
                            }}
                        >
                            <div className="text-center relative z-10">
                                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center transition-colors group-hover:bg-white" style={{ backgroundColor: '#E8F6F3' }}>
                                    <Home className="w-6 h-6" style={{ color: '#7DD3C0' }} />
                                </div>
                                <h4 className="text-lg mb-2 font-semibold" style={{ color: '#2C3E50' }}>Home Use</h4>
                                <p className="text-sm" style={{ color: '#7F8C8D' }}>
                                    For personal care, family members, and private households
                                </p>
                            </div>
                        </div>

                        {/* Clinical Use Option */}
                        <div
                            onClick={() => handleSelectType('clinical')}
                            className="p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg group relative overflow-hidden"
                            style={{
                                borderColor: '#E8F6F3',
                                backgroundColor: 'white'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#7DD3C0';
                                e.currentTarget.style.backgroundColor = '#F0FAF9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#E8F6F3';
                                e.currentTarget.style.backgroundColor = 'white';
                            }}
                        >
                            <div className="text-center relative z-10">
                                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center transition-colors group-hover:bg-white" style={{ backgroundColor: '#E8F6F3' }}>
                                    <Building2 className="w-6 h-6" style={{ color: '#7DD3C0' }} />
                                </div>
                                <h4 className="text-lg mb-2 font-semibold" style={{ color: '#2C3E50' }}>Clinical Use</h4>
                                <p className="text-sm" style={{ color: '#7F8C8D' }}>
                                    For hospitals, clinics, and healthcare facilities
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center pt-4">
                        <p className="text-sm" style={{ color: '#7F8C8D' }}>
                            Already have an account?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                className="underline font-medium hover:text-[#5ab3a0] transition-colors"
                                style={{ color: '#7DD3C0' }}
                            >
                                Log In
                            </button>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default UserTypeSelection;
