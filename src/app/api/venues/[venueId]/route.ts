import { handleLedgerRequest } from '../../../../server/ledger-runtime.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ venueId: string }> }): Promise<Response> {
  const { venueId } = await context.params;
  return handleLedgerRequest('venue-config', request, venueId);
}
