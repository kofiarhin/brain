import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Notes } from './pages/Notes';
import { DayPlan } from './pages/DayPlan';
import { Tasks } from './pages/Tasks';
import { TaskDetails } from './pages/TaskDetails';
import { Projects } from './pages/Projects';
import { GoalsIdeas } from './pages/GoalsIdeas';
import { ContextPage } from './pages/Context';
import { Reviews } from './pages/Reviews';
import { Reports } from './pages/Reports';
import './index.css';

const router = createBrowserRouter([{ path: '/', element: <AppLayout />, children: [
  { index: true, element: <Dashboard /> },
  { path: 'notes', element: <Notes /> },
  { path: 'day-plan', element: <DayPlan /> },
  { path: 'tasks', element: <Tasks /> },
  { path: 'tasks/:id', element: <TaskDetails /> },
  { path: 'projects', element: <Projects /> },
  { path: 'goals-ideas', element: <GoalsIdeas /> },
  { path: 'context', element: <ContextPage /> },
  { path: 'reviews', element: <Reviews /> },
  { path: 'reports', element: <Reports /> }
]}]);

createRoot(document.getElementById('root')).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>);
