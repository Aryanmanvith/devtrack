import { Compass } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { PageContainer } from '@/components/common/page'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/misc'

export function NotFoundPage() {
  const location = useLocation()
  return (
    <PageContainer>
      <Panel>
        <EmptyState
          icon={Compass}
          title="This page does not exist"
          description={
            <>
              Nothing lives at{' '}
              <code className="rounded bg-surface-2 px-1 text-[12.5px]">{location.pathname}</code>.
              Use the sidebar, or head back to the overview.
            </>
          }
          action={
            <Button asChild variant="primary">
              <Link to="/">Go to overview</Link>
            </Button>
          }
        />
      </Panel>
    </PageContainer>
  )
}
