import { handleLedgerRequest } from '../../../../../server/ledger-runtime.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ nightId: string }> }): Promise<Response> {
  const { nightId } = await context.params;
  return handleLedgerRequest('door-state', request, nightId);
}
