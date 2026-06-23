import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';

export function Dashboard() {
  const { data: plan, isLoading } = useQuery({ queryKey: ['dayPlans', 'latest'], queryFn: api.dayPlans.latest, retry: false });
  if (isLoading) return <p>Loading dashboard...</p>;
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Dashboard</h1>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Today's Focus"><p>{plan?.focus || 'No saved day plan yet.'}</p></Card>
      <Card title="Top 3 Priorities"><List items={plan?.priorities?.slice(0, 3)} /></Card>
      <Card title="Must Do"><List items={plan?.mustDo} /></Card>
      <Card title="Deliverables"><List items={plan?.deliverables} /></Card>
      <Card title="Win Condition"><List items={plan?.winCondition} /></Card>
    </div>
  </div>;
}
