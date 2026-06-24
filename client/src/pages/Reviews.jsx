import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

export function Reviews() {
  const reviews = useResource('reviews');

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold sm:text-3xl">Reviews</h1>
    <Card>
      <div className="space-y-4">
        {reviews.data?.map((review) => <article className="rounded-xl bg-slate-800 p-4" key={review._id}>
          <h2 className="font-semibold">{new Date(review.date).toLocaleDateString()}</h2>
          <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">Highlights: {review.wins?.join(', ')}</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-slate-300">Lessons: {review.lessons?.join(', ')}</p>
        </article>)}
      </div>
    </Card>
  </div>;
}
