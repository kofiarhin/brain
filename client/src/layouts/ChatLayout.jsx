import React from 'react';
import { Outlet } from 'react-router-dom';
import { GlobalPageLoadingOverlay } from '../components/GlobalPageLoader';

export function ChatLayout() {
  return (
    <div className="min-h-screen bg-app text-text-primary">
      <Outlet />
      <GlobalPageLoadingOverlay />
    </div>
  );
}
