import { lazy, Suspense } from 'react';
import type { ProductId } from '../core/ids';
import { hasWebGL2 } from '../gl/webgl';
import { MODELS } from '../products/models';
import { ObjectBox } from './ObjectBox';

// The inspection canvas loads only when a product view opens (Requirement 5.4).
const InspectionCanvas = lazy(() => import('../gl/InspectionCanvas'));

/** The large view in the product view: live and turnable, closer and haunted while inspecting. */
export function LargeView({ id, inspecting }: { id: ProductId; inspecting: boolean }) {
  const fallback = <ObjectBox id={id} size="large" />;
  if (!hasWebGL2() || !MODELS[id]) return fallback;
  return (
    <div className="large-view" data-inspecting={inspecting}>
      <div className="velvet" />
      <Suspense fallback={fallback}>
        <InspectionCanvas id={id} inspecting={inspecting} />
      </Suspense>
    </div>
  );
}
