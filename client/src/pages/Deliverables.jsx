import { EntityPage } from './EntityPage';
export function Deliverables() { return <EntityPage name="deliverables" title="Deliverables" fields={[['title','Title'], ['description','Description']]} editAction archiveAction />; }
