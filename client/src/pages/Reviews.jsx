import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';
export function Reviews() { const reviews = useResource('reviews'); return <div className="space-y-6"><h1 className="text-3xl font-bold">Reviews</h1><Card>{reviews.data?.map((review) => <article className="mb-4 rounded-xl bg-slate-800 p-4" key={review._id}><h2 className="font-semibold">{new Date(review.date).toLocaleDateString()}</h2><p>Wins: {review.wins?.join(', ')}</p><p>Lessons: {review.lessons?.join(', ')}</p></article>)}</Card></div>; }
