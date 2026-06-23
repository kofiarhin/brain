import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';

export function DayPlan() {
  const { data: plan } = useQuery({ queryKey: ['dayPlans', 'latest'], queryFn: api.dayPlans.latest, retry: false });
  const schedule = plan?.schedule?.map((item) => `${item.time} — ${item.activity}`) || [];
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Day Plan</h1>
    <Card title="Today's Focus"><p>{plan?.focus || 'No saved plan yet.'}</p></Card>
    <Card title="Top 3 Priorities"><List items={plan?.priorities} /></Card>
    <Card title="Day Plan"><List items={schedule} /></Card>
    <Card title="Must Do"><List items={plan?.mustDo} /></Card>
    <Card title="Should Do"><List items={plan?.shouldDo} /></Card>
    <Card title="Nice To Have"><List items={plan?.niceToHave} /></Card>
    <Card title="Things You May Be Forgetting"><List items={plan?.forgotten} /></Card>
    <Card title="Suggested Deliverables"><List items={plan?.deliverables} /></Card>
    <Card title="Win Condition"><List items={plan?.winCondition} /></Card>
    <Card title="Insight of the Day"><p>{plan?.insight || 'None'}</p></Card>
    <Card title="Motivational Post"><p className="whitespace-pre-wrap">{plan?.motivationalPost || 'None'}</p></Card>
    <Card title="Unclear Items"><List items={plan?.unclearItems?.length ? plan.unclearItems : ['None']} /></Card>
  </div>;
}
