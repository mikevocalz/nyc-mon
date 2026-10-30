import { activePreview } from '../../lib/site-preview';
import { PreviewBannerClient } from './PreviewBannerClient';
export async function PreviewBanner() { return await activePreview() ? <PreviewBannerClient /> : null; }
