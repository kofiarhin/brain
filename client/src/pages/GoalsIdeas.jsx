import { EntityPage } from './EntityPage';
export function GoalsIdeas() { return <div className="space-y-8"><EntityPage name="goals" title="Goals" fields={[['title','Title'], ['description','Description'], ['category','Category']]} /><EntityPage name="ideas" title="Ideas" fields={[['title','Title'], ['description','Description'], ['category','Category']]} /></div>; }
