import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function MainLayout() {
  return (
    <div className="flex h-screen bg-slate-50/50">
      {/* Sidebar - fixed width */}
      <div className="w-64 h-full shrink-0 shadow-lg z-20">
        <AppSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="w-full min-h-full pb-20">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
