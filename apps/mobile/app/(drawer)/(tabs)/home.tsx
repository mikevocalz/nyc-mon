import { SpatialScreen } from '@acme/spatial';
import { enterImmersive } from '../../../src/xr/enter-immersive';

export default function GridHomeRoute() {
  return <SpatialScreen enterImmersive={enterImmersive} />;
}
