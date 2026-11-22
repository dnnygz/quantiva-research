import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/feedback/states';

export default function NotFoundPage() {
  return (
    <div className="py-24">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={<Compass />}
        title="This page drifted away"
        description="The address does not match any page or available experiment."
        action={
          <Button asChild variant="aero">
            <Link to="/explore">Explore experiments</Link>
          </Button>
        }
      />
    </div>
  );
}
